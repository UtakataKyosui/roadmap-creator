import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./http";

const MAX_RETRIES = 2;

// 再試行するのはネットワーク失敗（fetchのTypeError）と5xxだけ。4xxや検証エラー、
// 不正なJSONなど、再試行しても結果が変わらない失敗は再試行しない。
const shouldRetry = (failureCount: number, error: unknown) => {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof ApiError) return error.status >= 500;
  return error instanceof TypeError;
};

export const createQueryClient = () =>
  new QueryClient({
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
