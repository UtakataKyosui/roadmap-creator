import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vite-plus/test";

type Input = {
  method: string;
  mode: string;
  pathname: string;
  sameOrigin: boolean;
  hasRange: boolean;
};
type Policy = {
  classifyRequest: (input: Input) => string;
  STATIC_CACHE: string;
  ICON_CACHE: string;
};

// public/sw.jsはaddEventListenerのない環境で評価すると判定ロジックだけを公開する。
const sandbox: { __swPolicy?: Policy } = {};
runInNewContext(readFileSync("public/sw.js", "utf8"), { self: sandbox });
const policy = sandbox.__swPolicy as Policy;

const base: Input = {
  method: "GET",
  mode: "no-cors",
  pathname: "/",
  sameOrigin: true,
  hasRange: false,
};
const classify = (patch: Partial<Input>) => policy.classifyRequest({ ...base, ...patch });

describe("classifyRequest", () => {
  it("/api/** は介入しない", () => {
    expect(classify({ pathname: "/api/auth/session" })).toBe("passthrough");
    expect(classify({ pathname: "/api/workspaces", mode: "cors" })).toBe("passthrough");
    expect(classify({ pathname: "/api" })).toBe("passthrough");
  });

  it("非GETは介入しない", () => {
    expect(classify({ method: "POST", pathname: "/assets/a.js" })).toBe("passthrough");
    expect(classify({ method: "POST", mode: "navigate" })).toBe("passthrough");
  });

  it("別オリジンとRangeリクエストは介入しない", () => {
    expect(classify({ pathname: "/assets/a.js", sameOrigin: false })).toBe("passthrough");
    expect(classify({ pathname: "/assets/a.js", hasRange: true })).toBe("passthrough");
  });

  it("ページ遷移はnavigate", () => {
    expect(classify({ mode: "navigate", pathname: "/w/1" })).toBe("navigate");
  });

  it("/api/ 配下へのナビゲーションでも介入しない", () => {
    expect(classify({ mode: "navigate", pathname: "/api/auth/callback" })).toBe("passthrough");
  });

  it("ビルド成果物はcache-first、アイコンはstale-while-revalidate", () => {
    expect(classify({ pathname: "/assets/index-AbC123.js" })).toBe("cache-first");
    expect(classify({ pathname: "/apple-touch-icon.png" })).toBe("stale-while-revalidate");
  });

  it("manifestとsw.jsなど上記以外は介入しない", () => {
    expect(classify({ pathname: "/site.webmanifest" })).toBe("passthrough");
    expect(classify({ pathname: "/sw.js" })).toBe("passthrough");
    expect(classify({ pathname: "/offline" })).toBe("passthrough");
  });
});
