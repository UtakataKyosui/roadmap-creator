// Roadmap Studio Service Worker。
// 方針: セッション状態を含むHTMLと /api/** は決してキャッシュしない。
// 更新: キャッシュ内容を変える変更では VERSION を上げる。旧キャッシュはactivateで削除する。
// sw.js自体はブラウザが更新確認のたびに取得し、差分があれば新SWがskipWaitingで即時有効になる。
const VERSION = "v1";
const STATIC_CACHE = `roadmap-static-${VERSION}`;
const ICON_CACHE = `roadmap-icons-${VERSION}`;
// Workers Assetsは .html 付きURLをリダイレクトするため、リダイレクトのない /offline を使う。
const OFFLINE_URL = "/offline";

const ICON_PATHS = new Set([
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon.png",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
]);

// リクエストの扱いを決める純粋関数。"passthrough" はSWが介入せずブラウザに任せる。
function classifyRequest({ method, mode, pathname, sameOrigin, hasRange }) {
  if (method !== "GET" || !sameOrigin || hasRange) return "passthrough";
  if (pathname === "/api" || pathname.startsWith("/api/")) return "passthrough";
  if (mode === "navigate") return "navigate";
  if (pathname.startsWith("/assets/")) return "cache-first";
  if (ICON_PATHS.has(pathname)) return "stale-while-revalidate";
  return "passthrough";
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.status === 200) await cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    refresh.catch(() => {});
    return cached;
  }
  return refresh;
}

if (typeof self.addEventListener === "function") {
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches
        .open(STATIC_CACHE)
        .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
        .then(() => self.skipWaiting()),
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) => key.startsWith("roadmap-") && key !== STATIC_CACHE && key !== ICON_CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        )
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    const strategy = classifyRequest({
      method: request.method,
      mode: request.mode,
      pathname: url.pathname,
      sameOrigin: url.origin === self.location.origin,
      hasRange: request.headers.has("range"),
    });

    if (strategy === "navigate") {
      // HTMLは常にネットワークから取得し、保存しない。失敗時のみオフライン画面を返す。
      event.respondWith(
        fetch(request).catch(async () => {
          const cached = await caches.match(OFFLINE_URL, { cacheName: STATIC_CACHE });
          return cached ?? Response.error();
        }),
      );
    } else if (strategy === "cache-first") {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
    } else if (strategy === "stale-while-revalidate") {
      event.respondWith(staleWhileRevalidate(request, ICON_CACHE));
    }
  });
} else {
  // テスト用。Service Worker外（addEventListenerなし）で評価されたときだけ判定ロジックを公開する。
  self.__swPolicy = { VERSION, STATIC_CACHE, ICON_CACHE, OFFLINE_URL, classifyRequest };
}
