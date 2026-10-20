import { devFixtures } from "../../db/dev-fixtures";
import { unauthorized } from "./errors";

// 認証基盤（#13）の導入前は、開発ビルドに限り開発用ユーザーとして扱う。
// 本番ビルドでは常に未認証になり、開発用の動作が外部に公開されることはない。
export const resolveActorId = (allowDevUser: boolean = import.meta.env.DEV) => {
  if (!allowDevUser) throw unauthorized();
  return devFixtures.userId;
};
