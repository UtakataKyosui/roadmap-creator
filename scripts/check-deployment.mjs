import { appendFile } from "node:fs/promises";
import { httpsOrigin } from "./deployment-config.mjs";

const origin = new URL(httpsOrigin(process.env.APP_URL ?? ""));
if (!process.env.CF_ACCESS_CLIENT_ID || !process.env.CF_ACCESS_CLIENT_SECRET)
  throw new Error("Access service credentials are required");
const headers = {
  "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID,
  "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET,
};
const anonymous = await fetch(new URL("/__void/ready", origin), {
  redirect: "manual",
  signal: AbortSignal.timeout(15000),
});
if (![302, 401, 403].includes(anonymous.status))
  throw new Error("Anonymous readiness must be blocked by Access");
// redirect:errorでAccessのログインHTMLを正常応答と誤認しない。
for (const [path, expected] of [
  ["/__void/ready", 200],
  ["/api/workspaces", 401],
]) {
  const response = await fetch(new URL(path, origin), {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status !== expected)
    throw new Error(`Health check failed: ${path} (${response.status})`);
  if (path.startsWith("/api")) {
    const body = await response.json();
    if (body.code !== "unauthorized") throw new Error("Anonymous API must remain unauthorized");
  }
}
const record = `Deployment health checks passed\n\n- Environment: ${process.env.DEPLOY_ENVIRONMENT}\n- Commit: ${process.env.DEPLOY_SHA ?? process.env.GITHUB_SHA}\n- PR: ${process.env.PR_NUMBER ?? "n/a"}\n- URL: ${origin.origin}\n`;
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, record);
console.log(record);
