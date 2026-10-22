import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const scripts = fileURLToPath(new URL("../../scripts/", import.meta.url));
const name = "rm-123-pr-40";
const config = {
  name,
  account_id: "account",
  preview_urls: false,
  workers_dev: true,
  routes: [],
  vars: { API_ORIGIN: `https://${name}.team.workers.dev` },
  d1_databases: [
    {
      binding: "DB",
      database_id: "owned-db",
      database_name: `${name}-db`,
      migrations_dir: "./db/migrations",
    },
  ],
};
const owner = {
  repository: "owner/repo",
  repositoryId: "123",
  pr: "40",
  worker: name,
  databaseId: "owned-db",
  origin: config.vars.API_ORIGIN,
};

// Execute the real entry points with a fake HTTP transport in a separate process.
// Each response checks its URL/method, so a wrong deletion target fails the test.
const run = (
  script: string,
  responses: Array<{
    path: string;
    method?: string;
    status?: number;
    result?: unknown;
    body?: unknown;
  }>,
  overrides: Record<string, string> = {},
) => {
  const cwd = mkdtempSync(join(tmpdir(), "roadmap-preview-"));
  const calls = join(cwd, "calls.jsonl");
  try {
    const root = join(cwd, "deploy/previews/pr-40");
    mkdirSync(root, { recursive: true });
    if (script !== "provision-preview.mjs") {
      writeFileSync(join(root, "void.lock.json"), JSON.stringify({ resolved: config }));
      writeFileSync(join(root, "ownership.json"), JSON.stringify(owner));
      writeFileSync(
        join(root, "void.config.ts"),
        `export default ${JSON.stringify({ cloudflare: config })}`,
      );
    }
    writeFileSync(join(cwd, "responses.json"), JSON.stringify(responses));
    const mock = join(cwd, "mock.mjs");
    writeFileSync(
      mock,
      `import { readFileSync, appendFileSync } from 'node:fs';
const responses = JSON.parse(readFileSync('responses.json', 'utf8'));
globalThis.fetch = async (url, init = {}) => {
  const call = { path: new URL(url).pathname, method: init.method ?? 'GET' };
  appendFileSync(${JSON.stringify(calls)}, JSON.stringify(call) + '\\n');
  const expected = responses.shift();
  if (!expected || !call.path.endsWith(expected.path) || call.method !== (expected.method ?? 'GET')) throw new Error('Unexpected HTTP request');
  const body = expected.body ?? (new URL(url).hostname === 'api.github.com' ? expected.result : { success: (expected.status ?? 200) < 400, result: expected.result });
  return new Response(JSON.stringify(body), { status: expected.status ?? 200 });
};`,
    );
    let error: unknown;
    try {
      execFileSync(process.execPath, ["--import", mock, join(scripts, script)], {
        cwd,
        stdio: "pipe",
        env: {
          ...process.env,
          PREVIEW_APPROVED: "true",
          ACCESS_READY: "true",
          DEPLOYMENT_READY: "true",
          GITHUB_REPOSITORY: "owner/repo",
          GITHUB_REPOSITORY_ID: "123",
          PR_NUMBER: "40",
          CLOUDFLARE_ACCOUNT_ID: "account",
          CLOUDFLARE_WORKERS_SUBDOMAIN: "team",
          APP_URL: owner.origin,
          CLOUDFLARE_API_TOKEN: "test-only",
          GH_TOKEN: "test-only",
          CF_ACCESS_CLIENT_ID: "test-only",
          CF_ACCESS_CLIENT_SECRET: "test-only",
          DEPLOY_ACTOR: "writer",
          PREVIEW_ACTION: "deploy",
          DEPLOY_SHA: "a".repeat(40),
          ...overrides,
        },
      });
    } catch (cause) {
      error = cause;
    }
    const requests = (() => {
      try {
        return readFileSync(calls, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as { path: string; method: string });
      } catch {
        return [];
      }
    })();
    const record = (() => {
      try {
        return JSON.parse(readFileSync(join(root, "ownership.json"), "utf8"));
      } catch {
        return undefined;
      }
    })();
    return { error, requests, record };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
};

describe("PR preview lifecycle", () => {
  const settingsPath = `/workers/scripts/${name}/settings`;
  const dbPath = "/d1/database/owned-db";
  const bindings = [{ type: "d1", name: "DB", id: "owned-db" }];

  test("provisioning records a newly created DB and refuses to adopt an existing DB", () => {
    const responses = [
      { path: "/collaborators/writer/permission", result: { permission: "write" } },
      {
        path: "/pulls/40",
        result: {
          state: "open",
          base: { ref: "main" },
          head: { sha: "a".repeat(40), repo: { full_name: "owner/repo" } },
        },
      },
      { path: "/d1/database", result: [] },
      { path: settingsPath, status: 404 },
      { path: "/d1/database", method: "POST", result: { uuid: "new-owned-db" } },
    ];
    const overrides = { CLOUDFLARE_ACCOUNT_ID: "a".repeat(32) };
    const result = run("provision-preview.mjs", responses, overrides);
    expect(result.error).toBeUndefined();
    expect(result.record).toMatchObject({
      repositoryId: "123",
      pr: "40",
      databaseId: "new-owned-db",
      worker: name,
    });
    const conflict = run(
      "provision-preview.mjs",
      [...responses.slice(0, 2), { path: "/d1/database", result: [{ uuid: "existing" }] }],
      overrides,
    );
    expect(conflict.error).toBeDefined();
    expect(conflict.requests.some((call) => call.method !== "GET")).toBe(false);
    expect(run("provision-preview.mjs", [], { PREVIEW_APPROVED: "false" }).requests).toEqual([]);
  });

  test("preparation requires reviewed isolation and matching origin", () => {
    expect(run("prepare-preview.mjs", []).error).toBeUndefined();
    expect(
      run("prepare-preview.mjs", [], { APP_URL: "https://production.example.com" }).error,
    ).toBeDefined();
    expect(run("prepare-preview.mjs", [], { ACCESS_READY: "false" }).error).toBeDefined();
  });

  test("health requires Access denial, service readiness and an unauthorized anonymous API", () => {
    const responses = [
      { path: "/__void/ready", status: 403 },
      { path: "/__void/ready", status: 200 },
      { path: "/api/workspaces", status: 401, body: { code: "unauthorized" } },
    ];
    expect(run("check-deployment.mjs", responses).error).toBeUndefined();
    expect(
      run("check-deployment.mjs", [{ path: "/__void/ready", status: 200 }]).error,
    ).toBeDefined();
    expect(
      run("check-deployment.mjs", [
        ...responses.slice(0, 2),
        { path: "/api/workspaces", status: 200 },
      ]).error,
    ).toBeDefined();
    expect(run("check-deployment.mjs", [], { CF_ACCESS_CLIENT_SECRET: "" }).error).toBeDefined();
  });

  test("owned resources are verified before deletion and missing resources permit retries", () => {
    const result = run("cleanup-preview.mjs", [
      { path: settingsPath, result: { bindings } },
      { path: dbPath, result: { uuid: "owned-db", name: `${name}-db` } },
      { path: "/workers/scripts", result: [{ id: name }] },
      { path: `/workers/scripts/${name}`, method: "DELETE" },
      { path: dbPath, method: "DELETE" },
    ]);
    expect(result.error).toBeUndefined();
    expect(result.requests.filter((call) => call.method === "DELETE")).toHaveLength(2);
    expect(
      run("cleanup-preview.mjs", [
        { path: settingsPath, status: 404 },
        { path: dbPath, status: 404 },
      ]).error,
    ).toBeUndefined();
  });

  test("wrong ownership, changed bindings, shared DB and denied reads never delete", () => {
    const cases = [
      run("cleanup-preview.mjs", [], { PR_NUMBER: "41" }),
      run("cleanup-preview.mjs", [], { CLOUDFLARE_ACCOUNT_ID: "other" }),
      run("cleanup-preview.mjs", [], { PREVIEW_APPROVED: "false" }),
      run("cleanup-preview.mjs", [{ path: settingsPath, status: 403 }]),
      run("cleanup-preview.mjs", [
        { path: settingsPath, result: { bindings: [{ type: "d1", name: "DB", id: "shared" }] } },
        { path: dbPath, result: { uuid: "owned-db", name: `${name}-db` } },
      ]),
      run("cleanup-preview.mjs", [
        { path: settingsPath, result: { bindings } },
        { path: dbPath, result: { uuid: "owned-db", name: "production" } },
      ]),
      run("cleanup-preview.mjs", [
        { path: settingsPath, result: { bindings } },
        { path: dbPath, result: { uuid: "owned-db", name: `${name}-db` } },
        { path: "/workers/scripts", result: [{ id: "shared-worker" }] },
        { path: "/workers/scripts/shared-worker/settings", result: { bindings } },
      ]),
    ];
    for (const result of cases) {
      expect(result.error).toBeDefined();
      expect(result.requests.some((call) => call.method === "DELETE")).toBe(false);
    }
  });

  test("only a writer's approved, current, same-repository head SHA is eligible", () => {
    const permission = {
      path: "/collaborators/writer/permission",
      result: { permission: "write" },
    };
    const pr = {
      state: "open",
      base: { ref: "main" },
      head: { sha: "a".repeat(40), repo: { full_name: "owner/repo" } },
    };
    expect(
      run("check-preview-pr.mjs", [permission, { path: "/pulls/40", result: pr }]).error,
    ).toBeUndefined();
    for (const changed of [
      { ...pr, state: "closed" },
      { ...pr, head: { ...pr.head, sha: "b".repeat(40) } },
      { ...pr, head: { ...pr.head, repo: { full_name: "fork/repo" } } },
    ]) {
      expect(
        run("check-preview-pr.mjs", [permission, { path: "/pulls/40", result: changed }]).error,
      ).toBeDefined();
    }
    expect(
      run("check-preview-pr.mjs", [{ ...permission, result: { permission: "read" } }]).error,
    ).toBeDefined();
    expect(
      run("check-preview-pr.mjs", [permission, { path: "/pulls/40", result: pr }], {
        PREVIEW_ACTION: "cleanup",
      }).error,
    ).toBeDefined();
    expect(
      run(
        "check-preview-pr.mjs",
        [permission, { path: "/pulls/40", result: { ...pr, state: "closed" } }],
        { PREVIEW_ACTION: "cleanup" },
      ).error,
    ).toBeUndefined();
  });
});
