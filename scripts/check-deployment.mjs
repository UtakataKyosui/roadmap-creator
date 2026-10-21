import { appendFile } from "node:fs/promises";

const origin = new URL(process.env.APP_URL ?? "");
if (origin.protocol !== "https:") throw new Error("HTTPS APP_URL is required");
const headers = {};
if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
  headers["CF-Access-Client-Id"] = process.env.CF_ACCESS_CLIENT_ID;
  headers["CF-Access-Client-Secret"] = process.env.CF_ACCESS_CLIENT_SECRET;
}
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
const record = `Deployment health checks passed\n\n- Environment: ${process.env.DEPLOY_ENVIRONMENT}\n- Commit: ${process.env.GITHUB_SHA}\n- URL: ${origin.origin}\n`;
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, record);
console.log(record);
