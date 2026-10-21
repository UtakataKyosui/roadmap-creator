import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

// Better AuthはHTTPエラーもresolveするため、成功を確認してから画面側でキャッシュを消す。
export const signOut = async () => {
  const result = await authClient.signOut();
  if (result.error) throw new Error("ログアウトできませんでした");
};
