import { appendFile } from "node:fs/promises";
import { readJson } from "./deployment-config.mjs";
import { previewName, validatePreview } from "./preview-config.mjs";

previewName(process.env.GITHUB_REPOSITORY_ID, process.env.PR_NUMBER);
const root = `deploy/previews/pr-${process.env.PR_NUMBER}`;
const owner = await readJson(`${root}/ownership.json`);
validatePreview(await readJson(`${root}/void.lock.json`), owner, {
  ...process.env,
  APP_URL: owner.origin,
});
await appendFile(process.env.GITHUB_ENV, `APP_URL=${owner.origin}\n`);
