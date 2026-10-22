import { mkdir, writeFile } from "node:fs/promises";
import { cloudflare } from "./cloudflare-api.mjs";
import { checkIsolation, optionalJson } from "./deployment-config.mjs";
import { previewName } from "./preview-config.mjs";

// Run from reviewed main only, after approving the dedicated account and Access setup.
if (process.env.PREVIEW_APPROVED !== "true" || process.env.ACCESS_READY !== "true")
  throw new Error("Explicit provisioning approval and configured Access are required");
if (process.env.PREVIEW_ACTION !== "deploy") throw new Error("Provision only an open approved PR");
await import("./check-preview-pr.mjs");
const name = previewName(process.env.GITHUB_REPOSITORY_ID, process.env.PR_NUMBER);
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const subdomain = process.env.CLOUDFLARE_WORKERS_SUBDOMAIN;
if (
  !/^[a-f0-9]{32}$/.test(account ?? "") ||
  !/^[a-z0-9-]+$/.test(subdomain ?? "") ||
  !/^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY ?? "")
)
  throw new Error("Configure the account, subdomain and repository");
const root = `deploy/previews/pr-${process.env.PR_NUMBER}`;
if (await optionalJson(`${root}/ownership.json`))
  throw new Error("A preview record already exists; do not provision twice");
const base = `/accounts/${account}`;
const existing = await cloudflare(`${base}/d1/database?name=${encodeURIComponent(`${name}-db`)}`);
if (existing.length)
  throw new Error("Refusing to adopt an existing D1 database without an ownership record");
if (
  (await cloudflare(`${base}/workers/scripts/${name}/settings`, { allowMissing: true })) !==
  undefined
)
  throw new Error("Refusing to adopt an existing Worker");
await mkdir(root, { recursive: true });
// Persist the returned identity immediately. If provisioning is interrupted, reconcile manually;
// never guess an existing DB's ownership and never delete it on a failed setup.
const database = await cloudflare(`${base}/d1/database`, {
  method: "POST",
  body: { name: `${name}-db` },
});
const origin = `https://${name}.${subdomain}.workers.dev`;
const ownership = {
  repository: process.env.GITHUB_REPOSITORY,
  repositoryId: process.env.GITHUB_REPOSITORY_ID,
  pr: process.env.PR_NUMBER,
  worker: name,
  databaseId: database.uuid,
  origin,
};
await writeFile(`${root}/ownership.json`, `${JSON.stringify(ownership, null, 2)}\n`, {
  flag: "wx",
});
const config = {
  account_id: account,
  name,
  compatibility_date: "2026-02-24",
  workers_dev: true,
  preview_urls: false,
  routes: [],
  vars: { API_ORIGIN: origin },
  d1_databases: [
    {
      binding: "DB",
      database_name: `${name}-db`,
      database_id: database.uuid,
      migrations_dir: "./db/migrations",
    },
  ],
};
await checkIsolation(config, root);
await writeFile(
  `${root}/void.config.ts`,
  `export default ${JSON.stringify({ cloudflare: config, routing: { isr: false } }, null, 2)};\n`,
);
await writeFile(
  `${root}/void.lock.json`,
  `${JSON.stringify({ version: 1, source: config, resolved: config, text: JSON.stringify(config, null, 2) }, null, 2)}\n`,
);
console.log(
  `Created dedicated D1. Review ${root}, configure preview-only OAuth/secrets, and commit the records to main before deploying. Worker has not been deployed.`,
);
