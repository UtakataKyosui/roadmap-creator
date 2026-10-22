import { describe, expect, test } from "vite-plus/test";
import { loginErrorMessage, loginUrl, safeRedirect } from "./auth-redirect";

describe("safeRedirect", () => {
  test("同じオリジンの絶対パス（クエリ付きを含む）はそのまま使う", () => {
    expect(safeRedirect("/w/1/p/2")).toBe("/w/1/p/2");
    expect(safeRedirect("/invitations/abc?x=1")).toBe("/invitations/abc?x=1");
  });

  test.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil",
    "/a\nb",
    "/login",
    "/login?redirect=/x",
    "/api/auth/sign-out",
    undefined,
    42,
  ])("%s は既定の戻り先になる", (value) => {
    expect(safeRedirect(value)).toBe("/");
  });
});

describe("loginUrl", () => {
  test("戻り先をエンコードして付ける。既定の戻り先は付けない", () => {
    expect(loginUrl("/w/1?a=b")).toBe("/login?redirect=%2Fw%2F1%3Fa%3Db");
    expect(loginUrl("/")).toBe("/login");
    expect(loginUrl("//evil.example")).toBe("/login");
  });
});

describe("loginErrorMessage", () => {
  test("コードなしならメッセージなし。キャンセルと通信失敗は専用の文言、他は汎用の文言", () => {
    expect(loginErrorMessage(undefined)).toBeUndefined();
    expect(loginErrorMessage("access_denied")).toContain("キャンセル");
    expect(loginErrorMessage("network")).toContain("通信");
    expect(loginErrorMessage("state_mismatch")).toContain("ログインできませんでした");
  });
});
