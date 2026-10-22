import { getRequestHeaders } from "@tanstack/react-start/server";
import { devFixtures } from "../../db/dev-fixtures";
import { AuthNotConfiguredError, getAuth } from "./better-auth";
import { unauthorized } from "./errors";
import { ensureAuthProfile } from "./auth-profile";
import { database } from "./database";

// リクエストのCookieからセッションを検証し、認証済みのユーザーIDを返す。なければnull。
const readSessionUserId = async () => {
  const session = await getAuth().api.getSession({ headers: getRequestHeaders() });
  if (session) await ensureAuthProfile(database, session.user.id);
  return session?.user.id ?? null;
};

type ResolveOptions = {
  allowDevUser?: boolean;
  readSession?: () => Promise<string | null>;
};

// 認証済みのユーザーIDを返す。セッションはサーバーが検証し、クライアントの申告は信用しない。
// 認証の環境変数が未設定の開発ビルドに限り、開発用ユーザーとして扱う。
// 本番ビルドでは未設定でも開発用ユーザーにはならず、常に未認証になる。
export const resolveActorId = async ({
  allowDevUser = import.meta.env.DEV,
  readSession = readSessionUserId,
}: ResolveOptions = {}) => {
  try {
    const userId = await readSession();
    if (!userId) throw unauthorized();
    return userId;
  } catch (error) {
    if (error instanceof AuthNotConfiguredError && allowDevUser) return devFixtures.userId;
    if (error instanceof AuthNotConfiguredError) throw unauthorized();
    throw error;
  }
};
