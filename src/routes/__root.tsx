/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRouteWithContext, redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { sessionQueryOptions } from "@/api/session";
import { getSiteOrigin } from "@/api/site";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { NotFound } from "@/components/NotFound";
import { safeRedirect } from "@/domain/auth-redirect";
import appCss from "@/styles/app.css?url";
import { seo } from "@/utils/seo";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // セッションはサーバーで検証する。未ログインならログイン画面へ送り、戻り先を同じオリジンの相対パスで渡す。
  beforeLoad: async ({ context: { queryClient }, location }) => {
    const user = await queryClient.ensureQueryData(sessionQueryOptions());
    if (!user && location.pathname !== "/login") {
      throw redirect({ to: "/login", search: { redirect: safeRedirect(location.href) } });
    }
    return { user };
  },
  // メタタグの絶対URLに使う公開オリジン。配備ごとに不変なので、遷移のたびに取り直さない。
  loader: async () => ({ siteOrigin: await getSiteOrigin() }),
  staleTime: Infinity,
  gcTime: Infinity,
  head: ({ loaderData }) => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      ...seo({
        title: "Roadmap Studio",
        description: "学習やプロジェクトのロードマップを、ボードとタイムラインで管理する。",
        origin: loaderData?.siteOrigin ?? "http://localhost:3000",
        siteName: "Roadmap Studio",
        imagePath: "/og-image.png",
        imageAlt:
          "Roadmap Studio のロゴと、ロードマップをボードとタイムラインで管理するサービスの説明",
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
