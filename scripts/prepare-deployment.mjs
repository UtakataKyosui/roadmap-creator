import { copyFile, readFile } from "node:fs/promises";

const target = process.env.DEPLOY_ENVIRONMENT;
if (!["staging", "production"].includes(target)) throw new Error("Unknown deployment environment");
if (process.env.DEPLOYMENT_READY !== "true" || process.env.ACCESS_READY !== "true") {
  throw new Error(
    "Configure isolated resources and Access before enabling deployment (docs/deployment.md)",
  );
}
if (target === "production" && process.env.AUTH_READY !== "true") {
  throw new Error("Production requires completed authentication and an approved release");
}
const url = new URL(process.env.APP_URL ?? "");
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash
) {
  throw new Error("APP_URL must be an HTTPS origin");
}
// 環境ごとのレビュー済み設定・lockがない場合は配備せず終了する。
// リソースの初回作成や既存Workerの移行はCIの外で明示的に行う。
const root = `deploy/${target}`;
const lock = JSON.parse(await readFile(`${root}/void.lock.json`, "utf8"));
if (!lock.resolved?.name || !lock.resolved?.account_id)
  throw new Error("Missing locked Worker identity");
if (target === "staging") {
  const production = JSON.parse(await readFile("void.lock.json", "utf8"));
  if (
    lock.resolved.name === production.resolved?.name &&
    lock.resolved.account_id === production.resolved?.account_id
  ) {
    throw new Error("Staging must use a separate Worker");
  }
}
await copyFile(`${root}/void.config.ts`, "void.config.ts");
await copyFile(`${root}/void.lock.json`, "void.lock.json");
