import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { env } from "void/env";
import { Effect } from "effect";
import { z } from "zod";
import { runPromise } from "@/lib/effect";
import {
  ErrorCode,
  type Error as ApiErrorBody,
  type ErrorDetail,
} from "@roadmapper/api-contract/models";

export class ApiError extends Error {
  readonly _tag = "ApiError";
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ErrorDetail[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details ?? [];
  }

  get isUnauthorized() {
    return this.status === 401 || this.code === "unauthorized";
  }

  get isVersionConflict() {
    return this.code === "version_conflict";
  }

  get isValidationFailed() {
    return this.code === "validation_failed";
  }
}

export class NetworkError extends TypeError {
  readonly _tag = "NetworkError";
  constructor(cause: unknown) {
    super("APIに接続できませんでした", { cause });
    this.name = "NetworkError";
  }
}

export class RequestAbortedError extends Error {
  readonly _tag = "RequestAbortedError";
  constructor(cause: unknown) {
    super("リクエストがキャンセルされました", { cause });
    this.name = "AbortError";
  }
}

export class InvalidResponseError extends Error {
  readonly _tag = "InvalidResponseError";
  constructor(cause: unknown) {
    super("APIの応答をJSONとして解釈できません", { cause });
    this.name = "InvalidResponseError";
  }
}

export class RequestError extends Error {
  readonly _tag = "RequestError";
  constructor(cause: unknown) {
    super("APIリクエストを構築できません", { cause });
    this.name = "RequestError";
  }
}

export type HttpClientError =
  | ApiError
  | NetworkError
  | RequestAbortedError
  | InvalidResponseError
  | RequestError;

// サーバー側のレンダリングでは相対URLを解決できないため、APIのオリジンを環境変数で与える。
// workerdでは .env の値が process.env に入らないため、void/env 経由で読む。
// リクエストの外（テストなど）ではCloudflareのenvを参照できないため、既定のオリジンを使う。
const serverOrigin = createServerOnlyFn(() => {
  try {
    return (env as { API_ORIGIN?: string }).API_ORIGIN ?? "http://localhost:3000";
  } catch {
    return "http://localhost:3000";
  }
});

const resolveUrl = (url: string) =>
  typeof window === "undefined" ? new URL(url, serverOrigin()).toString() : url;

// SSR中のAPI呼び出しには、ブラウザからのリクエストのCookieを転送する。
// リクエストの外（テストなど）では取得できないため、その場合は何も転送しない。
const incomingCookie = createServerOnlyFn(() => {
  try {
    return getRequestHeaders().get("cookie");
  } catch {
    return null;
  }
});

const buildHeaders = (init: HeadersInit | undefined) => {
  const headers = new Headers(init);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (typeof window === "undefined" && !headers.has("Cookie")) {
    const cookie = incomingCookie();
    if (cookie) headers.set("Cookie", cookie);
  }
  return headers;
};

const errorBodySchema = z.object({
  code: z.enum(ErrorCode),
  message: z.string(),
  details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

const toErrorBody = (status: number, text: string): ApiErrorBody => {
  try {
    const result = errorBodySchema.safeParse(JSON.parse(text));
    if (result.success) return result.data;
  } catch {
    // JSONではない応答（プロキシのエラーページなど）は内部エラーとして扱う。
  }
  return { code: "internal", message: `Unexpected response (${status})` };
};

// Orvalが生成するクライアントの共通HTTP層。成功時は { data, status, headers } を返し、
// 2xx以外はApiErrorを投げる。投げることでTanStack Queryがエラー状態として扱う。
export const customFetchEffect = <T>(
  url: string,
  options: RequestInit,
): Effect.Effect<T, HttpClientError> =>
  Effect.gen(function* () {
    const request = yield* Effect.try({
      try: () => ({
        url: resolveUrl(url),
        init: {
          credentials: "include" as const,
          ...options,
          headers: buildHeaders(options.headers),
        },
      }),
      catch: (cause) => new RequestError(cause),
    });
    const transportError = (cause: unknown) =>
      options.signal?.aborted || (cause instanceof Error && cause.name === "AbortError")
        ? new RequestAbortedError(cause)
        : new NetworkError(cause);
    const res = yield* Effect.tryPromise({
      try: () => fetch(request.url, request.init),
      catch: transportError,
    });
    const text = [204, 205, 304].includes(res.status)
      ? ""
      : yield* Effect.tryPromise({ try: () => res.text(), catch: transportError });
    if (!res.ok) return yield* Effect.fail(new ApiError(res.status, toErrorBody(res.status, text)));
    const data: unknown = yield* Effect.try({
      try: (): unknown => (text ? JSON.parse(text) : undefined),
      catch: (cause) => new InvalidResponseError(cause),
    });
    return { data, status: res.status, headers: res.headers } as T;
  });

export const customFetch = <T>(url: string, options: RequestInit): Promise<T> =>
  runPromise(customFetchEffect<T>(url, options));

// HTTPエラーだけでなく、通信・キャンセル・JSON解析の失敗も生成クライアントに伝える。
export type ErrorType<_Error> = HttpClientError;
