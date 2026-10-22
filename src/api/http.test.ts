import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { Effect, Either } from "effect";
import {
  ApiError,
  customFetch,
  customFetchEffect,
  InvalidResponseError,
  NetworkError,
  RequestAbortedError,
  RequestError,
} from "./http";
import { createQueryClient } from "./query-client";
import { apiErrorMessage, isRetryable } from "./error-message";

afterEach(() => vi.unstubAllGlobals());

describe("Effect HTTP境界", () => {
  test("Effectを実行するまで通信せず、成功時にデータとステータスを返す", async () => {
    const fetchMock = vi.fn(async () => Response.json({ value: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const program = customFetchEffect("/api/test", {});
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(Effect.runPromise(program)).resolves.toMatchObject({
      status: 200,
      data: { value: 1 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([401, 403, 404, 409, 422, 500])("HTTP %iをApiErrorとして保持する", async (status) => {
    vi.stubGlobal("fetch", async () =>
      Response.json(
        {
          code: "validation_failed",
          message: "invalid",
          details: [{ path: "/name", message: "x" }],
        },
        { status },
      ),
    );
    const error = await customFetch("/api/test", {}).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, details: [{ path: "/name", message: "x" }] });
    expect(isRetryable(error)).toBe(status >= 500);
  });

  test.each([
    "<html>proxy error</html>",
    JSON.stringify({ code: { invalid: true }, message: 123, details: "invalid" }),
    JSON.stringify({ code: "unknown", message: "invalid" }),
  ])("壊れたエラー本文でもHTTPステータスを失わない: %s", async (body) => {
    vi.stubGlobal("fetch", async () => new Response(body, { status: 503 }));
    await expect(customFetch("/api/test", {})).rejects.toMatchObject({
      _tag: "ApiError",
      status: 503,
      code: "internal",
      details: [],
    });
  });

  test("不正な成功JSONは検証可能なエラーになり、再試行しない", async () => {
    const fetchMock = vi.fn(async () => new Response("{"));
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();
    try {
      await expect(
        client.fetchQuery({ queryKey: ["bad-json"], queryFn: () => customFetch("/api/test", {}) }),
      ).rejects.toBeInstanceOf(InvalidResponseError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(isRetryable(new InvalidResponseError(null))).toBe(false);
    } finally {
      client.clear();
    }
  });

  test("通信失敗のcauseを保持し、Effectの失敗チャネルへ伝える", async () => {
    const cause = new TypeError("connection refused");
    vi.stubGlobal("fetch", async () => {
      throw cause;
    });
    const result = await Effect.runPromise(Effect.either(customFetchEffect("/api/test", {})));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(NetworkError);
      expect(result.left.cause).toBe(cause);
      expect(isRetryable(result.left)).toBe(true);
    }
  });

  test("本文読み取り中の通信失敗もNetworkErrorになる", async () => {
    const response = new Response("ok");
    const cause = new TypeError("stream closed");
    vi.spyOn(response, "text").mockRejectedValue(cause);
    vi.stubGlobal("fetch", async () => response);
    await expect(customFetch("/api/test", {})).rejects.toMatchObject({
      _tag: "NetworkError",
      cause,
    });
  });

  test("通信中のキャンセルをfetchへ伝え、再試行しない", async () => {
    const controller = new AbortController();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
          started();
        }),
    );
    const client = createQueryClient();
    try {
      const pending = client.fetchQuery({
        queryKey: ["abort"],
        queryFn: () => customFetch("/api/test", { signal: controller.signal }),
      });
      await ready;
      controller.abort();
      await expect(pending).rejects.toBeInstanceOf(RequestAbortedError);
      const error = new RequestAbortedError(controller.signal.reason);
      expect(isRetryable(error)).toBe(false);
      expect(apiErrorMessage(error)).toContain("キャンセル");
    } finally {
      client.clear();
    }
  });

  test("不正なリクエスト設定は通信失敗と区別し、fetchを呼ばない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      customFetch("/api/test", { headers: { "bad header": "x" } }),
    ).rejects.toBeInstanceOf(RequestError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isRetryable(new RequestError(null))).toBe(false);
  });
});
