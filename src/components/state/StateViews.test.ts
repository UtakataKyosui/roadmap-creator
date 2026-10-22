import { describe, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "@/api/http";
import { apiErrorMessage, isRetryable } from "@/api/error-message";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

const apiError = (status: number, code: ConstructorParameters<typeof ApiError>[1]["code"]) =>
  new ApiError(status, { code, message: "内部メッセージ" });

describe("エラー文言", () => {
  test("codeで文言を決め、APIのmessageをそのまま出さない", () => {
    for (const code of [
      "unauthorized",
      "forbidden",
      "not_found",
      "version_conflict",
      "validation_failed",
      "internal",
    ] as const) {
      const message = apiErrorMessage(apiError(code === "internal" ? 500 : 400, code));
      expect(message).not.toContain("内部メッセージ");
      expect(message.length).toBeGreaterThan(5);
    }
    expect(apiErrorMessage(new TypeError("fetch failed"))).toContain("ネットワーク");
    expect(apiErrorMessage(new Error("x"))).toContain("予期しない");
  });

  test("再試行できるのは5xxとネットワーク失敗だけ", () => {
    expect(isRetryable(apiError(500, "internal"))).toBe(true);
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(apiError(404, "not_found"))).toBe(false);
    expect(isRetryable(apiError(403, "forbidden"))).toBe(false);
    expect(isRetryable(apiError(409, "version_conflict"))).toBe(false);
  });
});

describe("状態表示", () => {
  test("読み込み中・0件・取得失敗を区別して表示する", () => {
    expect(renderToStaticMarkup(createElement(LoadingState))).toContain("読み込み中");
    expect(renderToStaticMarkup(createElement(EmptyState, { title: "なし" }))).toContain("なし");
    const failed = renderToStaticMarkup(
      createElement(ErrorState, { error: apiError(500, "internal"), onRetry: () => {} }),
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("再試行");
  });

  test("再試行しても変わらないエラーには再試行ボタンを出さない", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorState, { error: apiError(403, "forbidden"), onRetry: () => {} }),
    );
    expect(html).toContain("権限");
    expect(html).not.toContain("再試行");
  });
});
