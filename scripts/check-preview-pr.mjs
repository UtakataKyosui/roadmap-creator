import { appendFile } from "node:fs/promises";
import { previewName } from "./preview-config.mjs";

previewName(process.env.GITHUB_REPOSITORY_ID, process.env.PR_NUMBER);
const repository = process.env.GITHUB_REPOSITORY;
const api = async (path) => {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub eligibility check failed (${response.status})`);
  return response.json();
};
const permission = await api(
  `collaborators/${encodeURIComponent(process.env.DEPLOY_ACTOR)}/permission`,
);
if (!["admin", "maintain", "write"].includes(permission.permission))
  throw new Error("A repository writer must approve previews");
const pr = await api(`pulls/${process.env.PR_NUMBER}`);
if (process.env.PREVIEW_ACTION === "cleanup") {
  if (pr.state !== "closed") throw new Error("Cleanup requires a closed PR");
} else {
  if (
    pr.state !== "open" ||
    pr.head.repo?.full_name !== repository ||
    pr.base.ref !== "main" ||
    pr.head.sha !== process.env.DEPLOY_SHA ||
    !/^[a-f0-9]{40}$/.test(process.env.DEPLOY_SHA ?? "")
  )
    throw new Error(
      "Only the approved current SHA of an open same-repository PR targeting main can deploy",
    );
}
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `sha=${pr.head.sha}\n`);
