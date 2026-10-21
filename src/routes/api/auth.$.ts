import { createFileRoute } from "@tanstack/react-router";
import { AuthNotConfiguredError, getAuth } from "@/server/better-auth";

const handle = async (request: Request) => {
  try {
    return await getAuth().handler(request);
  } catch (error) {
    if (error instanceof AuthNotConfiguredError) {
      return Response.json(
        { code: "internal", message: "認証が設定されていません" },
        { status: 503 },
      );
    }
    throw error;
  }
};

// Better Authのエンドポイント（Googleへの遷移、コールバック、セッション取得、ログアウト）。
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
