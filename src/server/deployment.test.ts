import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const script = fileURLToPath(new URL("../../scripts/prepare-deployment.mjs", import.meta.url));

describe("CDの配備前確認", () => {
  const run = (
    overrides: Record<string, string>,
    stageWorker = "staging",
    stageDb = "staging-db",
    otherEnvironment = false,
  ) => {
    const cwd = mkdtempSync(join(tmpdir(), "roadmap-deploy-"));
    try {
      mkdirSync(join(cwd, "deploy/staging"), { recursive: true });
      writeFileSync(join(cwd, "void.config.ts"), "original");
      writeFileSync(
        join(cwd, "void.lock.json"),
        JSON.stringify({
          resolved: {
            name: "production",
            account_id: "account",
            d1_databases: [{ database_id: "production-db", database_name: "production-db" }],
          },
        }),
      );
      const config = {
        name: stageWorker,
        account_id: "account",
        preview_urls: false,
        vars: { API_ORIGIN: "https://staging.example.com" },
        d1_databases: [
          {
            binding: "DB",
            database_id: stageDb,
            database_name: stageDb,
            migrations_dir: "./db/migrations",
          },
        ],
      };
      writeFileSync(
        join(cwd, "deploy/staging/void.config.ts"),
        `export default ${JSON.stringify({ cloudflare: config })}`,
      );
      writeFileSync(
        join(cwd, "deploy/staging/void.lock.json"),
        JSON.stringify({ resolved: config }),
      );
      if (otherEnvironment) {
        mkdirSync(join(cwd, "deploy/production"), { recursive: true });
        writeFileSync(
          join(cwd, "deploy/production/void.lock.json"),
          JSON.stringify({ resolved: { ...config, name: "other-worker" } }),
        );
      }
      execFileSync(process.execPath, [script], {
        cwd,
        stdio: "pipe",
        env: {
          ...process.env,
          DEPLOY_ENVIRONMENT: "staging",
          DEPLOYMENT_READY: "true",
          ACCESS_READY: "true",
          APP_URL: "https://staging.example.com",
          CLOUDFLARE_ACCOUNT_ID: "account",
          ...overrides,
        },
      });
      return readFileSync(join(cwd, "void.config.ts"), "utf8");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  };

  test("Accessと環境設定が揃った専用Workerの設定だけを適用する", () => {
    expect(run({})).toContain('"name":"staging"');
  });
  test("Access未設定、認証未完了の本番、不正origin、共有Workerは配備を止める", () => {
    expect(() => run({ ACCESS_READY: "false" })).toThrow();
    expect(() => run({ DEPLOYMENT_READY: "false" })).toThrow();
    expect(() => run({ DEPLOY_ENVIRONMENT: "production", AUTH_READY: "false" })).toThrow();
    expect(() => run({ APP_URL: "http://example.com" })).toThrow();
    expect(() => run({ APP_URL: "https://example.com/path" })).toThrow();
    expect(() => run({}, "production")).toThrow();
    expect(() => run({}, "staging", "production-db")).toThrow();
    expect(() => run({}, "staging", "staging-db", true)).toThrow();
    expect(() => run({ CLOUDFLARE_ACCOUNT_ID: "other" })).toThrow();
    expect(() => run({ APP_URL: "https://wrong.example.com" })).toThrow();
  });
});
