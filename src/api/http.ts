import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { env } from "void/env";
import type { Error as ApiErrorBody, ErrorCode, ErrorDetail } from "./generated/models";

export class ApiError extends Error {
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

const toErrorBody = (status: number, text: string): ApiErrorBody => {
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body === "object" && body !== null && "code" in body && "message" in body) {
      return body as ApiErrorBody;
    }
  } catch {
    // JSONではない応答（プロキシのエラーページなど）は内部エラーとして扱う。
  }
  return { code: "internal", message: `Unexpected response (${status})` };
};

// Orvalが生成するクライアントの共通HTTP層。成功時は { data, status, headers } を返し、
// 2xx以外はApiErrorを投げる。投げることでTanStack Queryがエラー状態として扱う。
export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const res = await fetch(resolveUrl(url), {
    credentials: "include",
    ...options,
    headers: buildHeaders(options.headers),
  });

  const text = [204, 205, 304].includes(res.status) ? "" : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, toErrorBody(res.status, text));
  }

  const data: unknown = text ? JSON.parse(text) : undefined;
  return { data, status: res.status, headers: res.headers } as T;
};

// Orvalが生成するuseQuery/useMutationのエラー型。投げるのは常にApiError。
export type ErrorType<_Error> = ApiError;
