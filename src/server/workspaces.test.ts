import { beforeEach, describe, expect, test } from "vite-plus/test";
import { devFixtures } from "../../db/dev-fixtures";
import { parseResponse } from "../api/validation";
import { ListLabelsResponse } from "../api/generated/zod/labels/labels.zod";
import { ListProjectsResponse } from "../api/generated/zod/projects/projects.zod";
import {
  ListWorkspaceMembersResponse,
  ListWorkspacesResponse,
  CreateWorkspaceResponse,
} from "../api/generated/zod/workspaces/workspaces.zod";
import {
  createWorkspace,
  listLabels,
  listProjects,
  listWorkspaceMembers,
  listWorkspaces,
} from "./workspaces";
import {
  createTestDb,
  otherUserId,
  otherWorkspaceId,
  otherWorkspaceProjectId,
  seedTestDb,
} from "./testing/test-db";

const { userId, workspaceId, projectId, labelId } = devFixtures;
const missingId = "0190a000-0000-7000-8000-0000000000ff";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedTestDb(sqlite);
});

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error: { status?: number }) => error.status ?? 500,
  );

describe("Workspace", () => {
  test("作成者をownerにし、初期プロジェクトと一緒に保存する", async () => {
    const created = await createWorkspace(db, userId, {
      name: "  新しいチーム  ",
      ownerId: otherUserId,
    });
    parseResponse(CreateWorkspaceResponse, created);
    expect(created).toMatchObject({ name: "新しいチーム", version: 1 });
    expect(await listWorkspaceMembers(db, userId, created.id)).toMatchObject([
      { role: "owner", user: { id: userId } },
    ]);
    expect(await listProjects(db, userId, created.id)).toMatchObject([
      { workspaceId: created.id, name: "マイプロジェクト", archivedAt: null, version: 1 },
    ]);
    expect((await listWorkspaces(db, userId)).map((w) => w.id)).toContain(created.id);
    expect((await listWorkspaces(db, otherUserId)).map((w) => w.id)).not.toContain(created.id);
    expect(await status(listWorkspaceMembers(db, otherUserId, created.id))).toBe(403);
  });

  test("未所属のユーザーも最初のワークスペースを作成できる", async () => {
    sqlite.prepare("DELETE FROM memberships WHERE user_id = ?").run(userId);
    expect(await listWorkspaces(db, userId)).toEqual([]);
    const created = await createWorkspace(db, userId, { name: "最初のワークスペース" });
    expect((await listWorkspaces(db, userId)).map((w) => w.id)).toEqual([created.id]);
  });

  test("空・空白のみ・長すぎる名称や不正な本文を拒否し、保存しない", async () => {
    for (const body of [{ name: "" }, { name: "　 " }, { name: "a".repeat(101) }, {}, null, "x"]) {
      expect(await status(createWorkspace(db, userId, body))).toBe(422);
    }
    expect((await listWorkspaces(db, userId)).map((w) => w.id)).toEqual([workspaceId]);
    const created = await createWorkspace(db, userId, { name: "a".repeat(100) });
    expect(created.name).toHaveLength(100);
  });

  test("所有者または初期プロジェクトの保存失敗時は全体をロールバックする", async () => {
    for (const table of ["memberships", "projects"]) {
      const testDb = createTestDb({ failOn: new RegExp(`insert into "${table}"`, "i") });
      seedTestDb(testDb.sqlite);
      await expect(
        createWorkspace(testDb.db, userId, { name: "失敗するチーム" }),
      ).rejects.toThrow();
      expect(await listWorkspaces(testDb.db, userId)).toHaveLength(1);
      expect(testDb.sqlite.prepare("SELECT count(*) AS count FROM workspaces").get()).toMatchObject(
        { count: 2 },
      );
      expect(
        testDb.sqlite.prepare("SELECT count(*) AS count FROM memberships").get(),
      ).toMatchObject({ count: 2 });
      expect(testDb.sqlite.prepare("SELECT count(*) AS count FROM projects").get()).toMatchObject({
        count: 2,
      });
      testDb.sqlite.close();
    }
  });

  test("所属するWorkspaceだけを返し、契約を満たす", async () => {
    const mine = await listWorkspaces(db, userId);
    expect(mine.map((w) => w.id)).toEqual([workspaceId]);
    parseResponse(ListWorkspacesResponse, mine);
    expect((await listWorkspaces(db, otherUserId)).map((w) => w.id)).toEqual([otherWorkspaceId]);
    expect(await listWorkspaces(db, missingId)).toEqual([]);
  });

  test("メンバーはユーザー情報と役割を返し、契約を満たす", async () => {
    const members = await listWorkspaceMembers(db, userId, workspaceId);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      role: "owner",
      user: { id: userId, name: "開発ユーザー", email: "dev@example.com", avatarUrl: null },
    });
    parseResponse(ListWorkspaceMembersResponse, members);
  });
});

describe("ラベルとプロジェクト", () => {
  test("同じWorkspaceのラベルだけを名前順に返し、契約を満たす", async () => {
    sqlite
      .prepare(
        "INSERT INTO labels (id,workspace_id,name,color,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .run("0190a000-0000-7000-8000-0000000000a1", otherWorkspaceId, "他", "#112233", "t", "t");
    const labels = await listLabels(db, userId, workspaceId);
    expect(labels.map((l) => l.id)).toEqual([labelId]);
    parseResponse(ListLabelsResponse, labels);
  });

  test("同じWorkspaceのプロジェクトだけを返し、契約を満たす", async () => {
    const projects = await listProjects(db, userId, workspaceId);
    expect(projects.map((p) => p.id)).toEqual([projectId]);
    expect(projects[0]).toMatchObject({ archivedAt: null, version: 1 });
    parseResponse(ListProjectsResponse, projects);
    expect((await listProjects(db, otherUserId, otherWorkspaceId)).map((p) => p.id)).toEqual([
      otherWorkspaceProjectId,
    ]);
  });
});

describe("権限とエラー", () => {
  test("メンバーでなければ403、存在しない・UUIDでないWorkspaceは404", async () => {
    for (const list of [listWorkspaceMembers, listLabels, listProjects]) {
      expect(await status(list(db, otherUserId, workspaceId))).toBe(403);
      expect(await status(list(db, userId, missingId))).toBe(404);
      expect(await status(list(db, userId, "abc"))).toBe(404);
    }
  });
});
