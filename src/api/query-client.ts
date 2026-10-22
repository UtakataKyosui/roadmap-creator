import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { loginUrl } from "@/domain/auth-redirect";
import { ApiError } from "./http";
import { isRetryable } from "./error-message";

const MAX_RETRIES = 2;

// 再試行するのはネットワーク失敗（fetchのTypeError）と5xxだけ。4xxや検証エラー、
// 不正なJSONなど、再試行しても結果が変わらない失敗は再試行しない。
const shouldRetry = (failureCount: number, error: unknown) => {
  if (failureCount >= MAX_RETRIES) return false;
  return isRetryable(error);
};

export const createQueryClient = () => {
  // セッションが失効した後は、保護APIが401を返す。権限を失った利用者のデータを残さないようキャッシュを破棄し、
  // 現在の画面を戻り先にしてログイン画面へ送る。
  const onError = (error: unknown) => {
    if (typeof window === "undefined") return;
    if (!(error instanceof ApiError) || !error.isUnauthorized) return;
    if (window.location.pathname === "/login") return;
    client.clear();
    window.location.assign(loginUrl(window.location.pathname + window.location.search));
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        // SSRで取得した値をすぐにクライアントで再取得しないための猶予。
        staleTime: 30_000,
        retry: shouldRetry,
      },
      // 更新系は二重実行を避けるため再試行しない。
      mutations: { retry: false },
    },
  });
  return client;
};
