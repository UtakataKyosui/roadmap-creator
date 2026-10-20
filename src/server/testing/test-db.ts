import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../../../db/schema";
import { devFixtures } from "../../../db/dev-fixtures";
import type { Db } from "../db";

const migrationsDir = new URL("../../../db/migrations/", import.meta.url);

const migrationStatements = () =>
  readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .flatMap((name) =>
      readFileSync(new URL(name, migrationsDir), "utf8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean),
    );

// 本番のD1と同じスキーマを、メモリ上のSQLiteに生成済みのマイグレーションで作る。
// D1と同様に、外部キーを有効にし、batchを1つのトランザクションとして実行する。
export const createTestDb = (options: { failOn?: RegExp } = {}) => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const statement of migrationStatements()) sqlite.exec(statement);

  const run = (sql: string, params: unknown[], method: string) => {
    if (options.failOn?.test(sql)) throw new Error("simulated database failure");
    const statement = sqlite.prepare(sql);
    const values = params as Array<null | number | bigint | string>;
    if (method === "run") {
      statement.run(...values);
      return { rows: [] as unknown[] };
    }
    statement.setReturnArrays(true);
    const rows = statement.all(...values) as unknown as unknown[][];
    return { rows: method === "get" ? (rows[0] ?? []) : rows };
  };

  const db = drizzle(
    async (sql, params, method) => run(sql, params, method),
    async (queries) => {
      sqlite.exec("BEGIN");
      try {
        const results = queries.map((q) => run(q.sql, q.params, q.method));
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    { schema },
  ) as unknown as Db;

  return { db, sqlite };
};

const now = "2026-01-01T00:00:00.000Z";
export const otherUserId = "0190a000-0000-7000-8000-000000000002";
export const otherWorkspaceId = "0190a000-0000-7000-8000-000000000012";
export const otherWorkspaceProjectId = "0190a000-0000-7000-8000-000000000021";

// db/seed.tsと同じ開発用データに加え、権限・所属範囲の検証に使う別Workspaceと別ユーザーを作る。
export const seedTestDb = (sqlite: DatabaseSync) => {
  const exec = (sql: string, ...params: Array<string | null>) => sqlite.prepare(sql).run(...params);
  exec(
    "INSERT INTO users (id,name,email,created_at,updated_at) VALUES (?,?,?,?,?)",
    devFixtures.userId,
    "開発ユーザー",
    "dev@example.com",
    now,
    now,
  );
  exec(
    "INSERT INTO users (id,name,email,created_at,updated_at) VALUES (?,?,?,?,?)",
    otherUserId,
    "他のユーザー",
    "other@example.com",
    now,
    now,
  );
  exec(
    "INSERT INTO workspaces (id,name,created_at,updated_at) VALUES (?,?,?,?)",
    devFixtures.workspaceId,
    "開発用",
    now,
    now,
  );
  exec(
    "INSERT INTO workspaces (id,name,created_at,updated_at) VALUES (?,?,?,?)",
    otherWorkspaceId,
    "別のワークスペース",
    now,
    now,
  );
  exec(
    "INSERT INTO memberships (id,workspace_id,user_id,role,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    "0190a000-0000-7000-8000-000000000011",
    devFixtures.workspaceId,
    devFixtures.userId,
    "owner",
    now,
    now,
  );
  exec(
    "INSERT INTO memberships (id,workspace_id,user_id,role,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    "0190a000-0000-7000-8000-000000000013",
    otherWorkspaceId,
    otherUserId,
    "owner",
    now,
    now,
  );
  exec(
    "INSERT INTO projects (id,workspace_id,name,created_at,updated_at) VALUES (?,?,?,?,?)",
    devFixtures.projectId,
    devFixtures.workspaceId,
    "学習",
    now,
    now,
  );
  exec(
    "INSERT INTO projects (id,workspace_id,name,created_at,updated_at) VALUES (?,?,?,?,?)",
    otherWorkspaceProjectId,
    otherWorkspaceId,
    "別",
    now,
    now,
  );
};
