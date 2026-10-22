import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { checkIsolation, readJson } from "./deployment-config.mjs";
import { validatePreview } from "./preview-config.mjs";

if (process.env.DEPLOYMENT_READY !== "true" || process.env.ACCESS_READY !== "true")
  throw new Error("Review preview isolation and Access first");
const root = `deploy/previews/pr-${process.env.PR_NUMBER}`;
const config = validatePreview(
  await readJson(`${root}/void.lock.json`),
  await readJson(`${root}/ownership.json`),
);
const { default: reviewed } = await import(pathToFileURL(resolve(root, "void.config.ts")).href);
if (!isDeepStrictEqual(reviewed.cloudflare, config) || reviewed.worker?.vars?.API_ORIGIN)
  throw new Error("Preview config/lock mismatch");
await checkIsolation(config, root);
await copyFile(`${root}/void.config.ts`, "void.config.ts");
await copyFile(`${root}/void.lock.json`, "void.lock.json");
