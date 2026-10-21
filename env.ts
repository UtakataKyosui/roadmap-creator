import { defineEnv, string, url } from "void/env";

export default defineEnv({
  API_ORIGIN: url().default("http://localhost:3000"),
  // 認証（Better Auth）。ローカルでは .env、本番では void secret put で設定する。
  BETTER_AUTH_SECRET: string().optional(),
  GOOGLE_CLIENT_ID: string().optional(),
  GOOGLE_CLIENT_SECRET: string().optional(),
});
