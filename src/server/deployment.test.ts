import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const script = fileURLToPath(new URL("../../scripts/prepare-deployment.mjs", import.meta.url));

describe("CDの配備前確認", () => {
  const run = (overrides: Record<string, string>, stageWorker = "staging") => {
    const cwd = mkdtempSync(join(tmpdir(), "roadmap-deploy-"));
    try {
      mkdirSync(join(cwd, "deploy/staging"), { recursive: true });
      writeFileSync(join(cwd, "void.config.ts"), "original");
      writeFileSync(
        join(cwd, "void.lock.json"),
        JSON.stringify({ resolved: { name: "production", account_id: "account" } }),
      );
      writeFileSync(join(cwd, "deploy/staging/void.config.ts"), "staging config");
      writeFileSync(
        join(cwd, "deploy/staging/void.lock.json"),
        JSON.stringify({ resolved: { name: stageWorker, account_id: "account" } }),
      );
      execFileSync(process.execPath, [script], {
        cwd,
        stdio: "pipe",
        env: {
          ...process.env,
          DEPLOY_ENVIRONMENT: "staging",
          DEPLOYMENT_READY: "true",
          ACCESS_READY: "true",
          APP_URL: "https://staging.example.com",
          ...overrides,
        },
      });
      return readFileSync(join(cwd, "void.config.ts"), "utf8");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  };

  test("Accessと環境設定が揃った専用Workerの設定だけを適用する", () => {
    expect(run({})).toBe("staging config");
  });
  test("Access未設定、認証未完了の本番、不正origin、共有Workerは配備を止める", () => {
    expect(() => run({ ACCESS_READY: "false" })).toThrow();
    expect(() => run({ DEPLOYMENT_READY: "false" })).toThrow();
    expect(() => run({ DEPLOY_ENVIRONMENT: "production", AUTH_READY: "false" })).toThrow();
    expect(() => run({ APP_URL: "http://example.com" })).toThrow();
    expect(() => run({ APP_URL: "https://example.com/path" })).toThrow();
    expect(() => run({}, "production")).toThrow();
  });
});
