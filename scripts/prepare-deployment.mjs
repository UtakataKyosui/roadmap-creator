import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { checkIsolation, httpsOrigin, identity } from "./deployment-config.mjs";

const target = process.env.DEPLOY_ENVIRONMENT;
if (target !== "prod") throw new Error("Unknown deployment environment");
if (process.env.DEPLOYMENT_READY !== "true" || process.env.ACCESS_READY !== "true") {
  throw new Error(
    "Configure isolated resources and Access before enabling deployment (docs/deployment.md)",
  );
}
if (process.env.AUTH_READY !== "true") {
  throw new Error("Production requires completed authentication and an approved release");
}
const origin = httpsOrigin(process.env.APP_URL ?? "");
// 環境ごとのレビュー済み設定・lockがない場合は配備せず終了する。
// リソースの初回作成や既存Workerの移行はCIの外で明示的に行う。
const root = `deploy/${target}`;
const lock = JSON.parse(await readFile(`${root}/void.lock.json`, "utf8"));
const config = identity(lock);
const { default: reviewed } = await import(pathToFileURL(resolve(root, "void.config.ts")).href);
const declared = identity({ resolved: reviewed.cloudflare });
if (!isDeepStrictEqual(declared, config) || reviewed.worker?.vars?.API_ORIGIN) {
  throw new Error("Reviewed config must match the lock and must not override API_ORIGIN");
}
if (config.account_id !== process.env.CLOUDFLARE_ACCOUNT_ID)
  throw new Error("Account does not match the reviewed lock");
if (config.vars?.API_ORIGIN !== origin) throw new Error("API_ORIGIN does not match APP_URL");
await checkIsolation(config, root);
await copyFile(`${root}/void.config.ts`, "void.config.ts");
await copyFile(`${root}/void.lock.json`, "void.lock.json");
