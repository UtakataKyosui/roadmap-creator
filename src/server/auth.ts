import { getRequestHeaders } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { runPromise } from "@/lib/effect";
import { devFixtures } from "../../db/dev-fixtures";
import { AuthNotConfiguredError, getAuth } from "./better-auth";
import { serverEffect, unauthorized, type ServerError } from "./errors";
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
export const resolveActorIdEffect = ({
  allowDevUser = import.meta.env.DEV,
  readSession = readSessionUserId,
}: ResolveOptions = {}) => {
  return serverEffect(readSession).pipe(
    Effect.catchTag("UnexpectedServerError", (error): Effect.Effect<string | null, ServerError> => {
      if (!(error.cause instanceof AuthNotConfiguredError)) return Effect.fail(error);
      return allowDevUser ? Effect.succeed(devFixtures.userId) : Effect.fail(unauthorized());
    }),
    Effect.flatMap((userId) => (userId ? Effect.succeed(userId) : Effect.fail(unauthorized()))),
  );
};

export const resolveActorId = (options: ResolveOptions = {}) =>
  // セッション用ServerFnとの境界では、従来どおり元の例外を保持する。
  runPromise(
    resolveActorIdEffect(options).pipe(
      Effect.mapError((error) => (error._tag === "UnexpectedServerError" ? error.cause : error)),
    ),
  );
