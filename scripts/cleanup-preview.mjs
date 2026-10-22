import { cloudflare } from "./cloudflare-api.mjs";
import { checkIsolation, readJson } from "./deployment-config.mjs";
import { validatePreview } from "./preview-config.mjs";

if (process.env.PREVIEW_APPROVED !== "true")
  throw new Error("Explicit cleanup approval is required");
const root = `deploy/previews/pr-${process.env.PR_NUMBER}`;
const config = validatePreview(
  await readJson(`${root}/void.lock.json`),
  await readJson(`${root}/ownership.json`),
);
await checkIsolation(config, root);
const base = `/accounts/${config.account_id}`;
const workerPath = `${base}/workers/scripts/${config.name}`;
const dbPath = `${base}/d1/database/${config.d1_databases[0].database_id}`;
// Read and verify both resources before the first delete. 403/other errors are never treated as absence.
const settings = await cloudflare(`${workerPath}/settings`, { allowMissing: true });
const database = await cloudflare(dbPath, { allowMissing: true });
if (settings) {
  const dbs = settings.bindings?.filter((binding) => binding.type === "d1");
  if (dbs?.length !== 1 || dbs[0].name !== "DB" || dbs[0].id !== config.d1_databases[0].database_id)
    throw new Error("Live Worker bindings no longer match preview ownership");
}
if (
  database &&
  (database.uuid !== config.d1_databases[0].database_id ||
    database.name !== config.d1_databases[0].database_name)
)
  throw new Error("Live D1 no longer matches preview ownership");
if (database) {
  const workers = await cloudflare(`${base}/workers/scripts`);
  for (const worker of workers) {
    if (worker.id === config.name) continue;
    const other = await cloudflare(
      `${base}/workers/scripts/${encodeURIComponent(worker.id)}/settings`,
    );
    if (!Array.isArray(other.bindings)) throw new Error("Could not verify other Worker bindings");
    if (other.bindings.some((binding) => binding.type === "d1" && binding.id === database.uuid))
      throw new Error("D1 is referenced by another Worker; refusing cleanup");
  }
}
if (settings) await cloudflare(workerPath, { method: "DELETE" });
if (database) await cloudflare(dbPath, { method: "DELETE" });
console.log(
  `Preview PR #${process.env.PR_NUMBER}: dedicated Worker and D1 removed (or already absent). Shared Access policy is retained.`,
);
