import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { env } from "void/env";
import { authAccounts, authSessions, authUsers, authVerifications, users } from "../../db/schema";
import { database } from "./database";
import type { Db } from "./db";
import { uuidv7 } from "./ids";
import { ensureAuthProfile } from "./auth-profile";

export type AuthConfig = {
  baseURL: string;
  secret: string;
  google: { clientId: string; clientSecret: string };
};

export const LOGIN_PATH = "/login";

// 認証ユーザーの作成に合わせて、同じIDでアプリのユーザー（プロフィール）を作る。
// メールアドレスだけで既存のユーザーに結びつけることはしない。
export const createAuth = (db: Db, config: AuthConfig, extraPlugins: BetterAuthPlugin[] = []) =>
  betterAuth({
    baseURL: config.baseURL,
    secret: config.secret,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    socialProviders: { google: config.google },
    account: { accountLinking: { enabled: false } },
    advanced: { database: { generateId: () => uuidv7() } },
    onAPIError: { errorURL: LOGIN_PATH },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const [existing] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, user.email));
            if (existing) {
              throw new APIError("BAD_REQUEST", {
                message: "このメールアドレスは別のアカウントで使われています",
                code: "email_already_used",
              });
            }
          },
          after: async (user) => {
            await ensureAuthProfile(db, user.id);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            await ensureAuthProfile(db, session.userId);
          },
        },
      },
    },
    plugins: [...extraPlugins, tanstackStartCookies()],
  });

export type Auth = ReturnType<typeof createAuth>;

// 認証の環境変数が揃っていないことを表す。
export class AuthNotConfiguredError extends Error {
  constructor() {
    super(
      "認証の環境変数（BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET）が設定されていません",
    );
    this.name = "AuthNotConfiguredError";
  }
}

const readConfig = (): AuthConfig => {
  let values: Record<
    "API_ORIGIN" | "BETTER_AUTH_SECRET" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET",
    string | undefined
  >;
  try {
    const source = env as Partial<typeof values>;
    values = {
      API_ORIGIN: source.API_ORIGIN,
      BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
      GOOGLE_CLIENT_ID: source.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: source.GOOGLE_CLIENT_SECRET,
    };
  } catch {
    // リクエストの外（テストなど）ではCloudflareのenvを参照できない。
    throw new AuthNotConfiguredError();
  }
  const { API_ORIGIN, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = values;
  if (!API_ORIGIN || !BETTER_AUTH_SECRET || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new AuthNotConfiguredError();
  }
  return {
    baseURL: API_ORIGIN,
    secret: BETTER_AUTH_SECRET,
    google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET },
  };
};

let instance: Auth | undefined;

// envはリクエストの中でしか読めないため、最初の利用時に組み立てる。
export const getAuth = () => (instance ??= createAuth(database, readConfig()));
