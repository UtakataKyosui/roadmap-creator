import { afterEach, expect, test, vi } from "vite-plus/test";
import { authClient, signOut } from "./auth-client";

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({ signOut: vi.fn() }),
}));

afterEach(() => vi.resetAllMocks());

test("ログアウトのHTTP失敗を例外にし、呼び出し元の成功処理を止める", async () => {
  vi.mocked(authClient.signOut).mockResolvedValue({
    data: null,
    error: { status: 500, statusText: "Internal Server Error", message: "failure" },
  });
  await expect(signOut()).rejects.toThrow("ログアウトできませんでした");
});

test("ログアウト成功時は正常に完了する", async () => {
  vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });
  await expect(signOut()).resolves.toBeUndefined();
});

test("ログアウトのネットワーク失敗も呼び出し元へ伝える", async () => {
  vi.mocked(authClient.signOut).mockRejectedValue(new TypeError("network"));
  await expect(signOut()).rejects.toThrow("network");
});
