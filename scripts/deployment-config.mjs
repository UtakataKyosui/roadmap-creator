import { readFile, readdir } from "node:fs/promises";

export function httpsOrigin(value) {
  const url = new URL(value);
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
  return url.origin;
}

export function identity(lock) {
  const config = lock.resolved;
  const databases = config?.d1_databases;
  if (
    !config?.name ||
    !config.account_id ||
    databases?.length !== 1 ||
    databases[0].binding !== "DB" ||
    !databases[0].database_id ||
    !databases[0].database_name
  ) {
    throw new Error("A locked Worker and exactly one dedicated DB binding are required");
  }
  if (config.preview_urls !== false) throw new Error("Disable unprotected Worker version URLs");
  if (databases[0].migrations_dir !== "./db/migrations")
    throw new Error("Use committed migrations");
  return config;
}

export function assertSeparate(target, other) {
  if (target.account_id !== other.account_id) return;
  if (target.name === other.name) throw new Error("Environments must use separate Workers");
  if (
    other.d1_databases?.some(
      (db) =>
        db.database_id === target.d1_databases[0].database_id ||
        db.database_name === target.d1_databases[0].database_name,
    )
  ) {
    throw new Error("Environments must use separate D1 databases");
  }
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

// Only an absent file is optional; malformed or unreadable configuration must fail closed.
export async function optionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

export async function checkIsolation(config, root) {
  const paths = [
    "void.lock.json",
    "deploy/prod/void.lock.json",
    // Also reject sharing with any locks left from earlier environment proposals.
    "deploy/staging/void.lock.json",
    "deploy/production/void.lock.json",
  ];
  let previews = [];
  try {
    previews = await readdir("deploy/previews");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  paths.push(...previews.map((name) => `deploy/previews/${name}/void.lock.json`));
  for (const path of paths) {
    if (path === `${root}/void.lock.json`) continue;
    const other = await optionalJson(path);
    if (other) assertSeparate(config, other.resolved);
  }
}
