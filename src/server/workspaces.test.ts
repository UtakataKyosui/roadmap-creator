import { beforeEach, describe, expect, test } from "vite-plus/test";
import { devFixtures } from "../../db/dev-fixtures";
import { parseResponse } from "../api/validation";
import { ListLabelsResponse } from "@roadmapper/api-contract/zod/labels/labels.zod";
import {
  ListProjectsResponse,
  UpdateProjectResponse,
} from "@roadmapper/api-contract/zod/projects/projects.zod";
import {
  ListWorkspaceMembersResponse,
  ListWorkspacesResponse,
  CreateWorkspaceResponse,
  UpdateWorkspaceResponse,
} from "@roadmapper/api-contract/zod/workspaces/workspaces.zod";
import {
  createWorkspace,
  deleteWorkspace,
  updateWorkspace,
  updateProject,
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
  test.each(["workspace", "project"] as const)(
    "%sの名称を変更し、権限と更新競合を検証する",
    async (kind) => {
      const rename = (actor: string, body: unknown) =>
        kind === "workspace"
          ? updateWorkspace(db, actor, workspaceId, body)
          : updateProject(db, actor, workspaceId, projectId, body);
      const read = async () =>
        kind === "workspace"
          ? (await listWorkspaces(db, userId))[0]
          : (await listProjects(db, userId, workspaceId))[0];
      const before = await read();
      expect(await status(rename(otherUserId, { name: "不正な変更", version: 1 }))).toBe(403);
      const updated = await rename(userId, {
        name: "  新しい名称  ",
        version: 1,
        id: missingId,
        workspaceId: otherWorkspaceId,
      });
      expect(updated).toMatchObject({
        id: before.id,
        name: "新しい名称",
        version: 2,
        createdAt: before.createdAt,
      });
      if (kind === "workspace") parseResponse(UpdateWorkspaceResponse, updated);
      else parseResponse(UpdateProjectResponse, updated);
      expect(await read()).toMatchObject({ name: "新しい名称", version: 2 });
      expect(await status(rename(userId, { name: "古い編集", version: 1 }))).toBe(409);
      expect(await read()).toMatchObject({ name: "新しい名称", version: 2 });
      sqlite
        .prepare(
          "INSERT INTO memberships (id,workspace_id,user_id,role,created_at,updated_at) VALUES (?,?,?,?,?,?)",
        )
        .run(missingId, workspaceId, otherUserId, "admin", "t", "t");
      expect(await rename(otherUserId, { name: "管理者の変更", version: 2 })).toMatchObject({
        name: "管理者の変更",
        version: 3,
      });
      sqlite.prepare("UPDATE memberships SET role = 'member' WHERE id = ?").run(missingId);
      expect(await status(rename(otherUserId, { name: "メンバーの変更", version: 3 }))).toBe(403);
      expect(await read()).toMatchObject({ name: "管理者の変更", version: 3 });
    },
  );

  test.each(["workspace", "project"] as const)("%sの改名で不正な入力を保存しない", async (kind) => {
    const rename = (body: unknown) =>
      kind === "workspace"
        ? updateWorkspace(db, userId, workspaceId, body)
        : updateProject(db, userId, workspaceId, projectId, body);
    for (const body of [
      { name: "", version: 1 },
      { name: "　 ", version: 1 },
      { name: "a".repeat(101), version: 1 },
      { name: "x" },
      { name: "x", version: 0 },
      null,
    ]) {
      expect(await status(rename(body))).toBe(422);
    }
    expect(await rename({ name: "a".repeat(100), version: 1 })).toMatchObject({
      name: "a".repeat(100),
      version: 2,
    });
  });

  test("改名対象の不正・存在しないIDや別Workspaceのプロジェクトは404", async () => {
    for (const id of ["invalid", missingId]) {
      expect(await status(updateWorkspace(db, userId, id, { name: "x", version: 1 }))).toBe(404);
      expect(
        await status(updateProject(db, userId, workspaceId, id, { name: "x", version: 1 })),
      ).toBe(404);
    }
    expect(
      await status(
        updateProject(db, userId, workspaceId, otherWorkspaceProjectId, { name: "x", version: 1 }),
      ),
    ).toBe(404);
    expect((await listProjects(db, otherUserId, otherWorkspaceId))[0].name).toBe("別");
  });

  test("ownerは配下のデータをまとめて削除でき、別Workspaceとユーザーを保持する", async () => {
    sqlite
      .prepare(
        "INSERT INTO tasks (id,roadmap_id,workspace_id,title,status,priority,assignee_id,sort_order,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        missingId,
        devFixtures.roadmapId,
        workspaceId,
        "削除対象",
        "todo",
        "medium",
        userId,
        "a0",
        userId,
        "t",
        "t",
      );
    sqlite
      .prepare("INSERT INTO task_labels (task_id,label_id,workspace_id) VALUES (?,?,?)")
      .run(missingId, labelId, workspaceId);
    sqlite
      .prepare(
        "INSERT INTO comments (id,task_id,author_id,body,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .run(missingId, missingId, userId, "コメント", "t", "t");
    sqlite
      .prepare(
        "INSERT INTO invitations (id,workspace_id,email,role,token_hash,invited_by,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .run(missingId, workspaceId, "invite@example.com", "member", "hash", userId, "t", "t", "t");
    await deleteWorkspace(db, userId, workspaceId);
    expect(await listWorkspaces(db, userId)).toEqual([]);
    expect((await listWorkspaces(db, otherUserId)).map((item) => item.id)).toEqual([
      otherWorkspaceId,
    ]);
    for (const table of ["projects", "roadmaps", "memberships", "labels", "tasks", "invitations"]) {
      expect(
        sqlite
          .prepare(`SELECT count(*) AS count FROM ${table} WHERE workspace_id = ?`)
          .get(workspaceId),
      ).toMatchObject({ count: 0 });
    }
    for (const table of ["comments", "task_labels"]) {
      expect(sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get()).toMatchObject({
        count: 0,
      });
    }
    expect(sqlite.prepare("SELECT count(*) AS count FROM users").get()).toMatchObject({ count: 2 });
  });

  test("admin・member・所属外は削除できず、存在しない・不正なIDは404", async () => {
    expect(await status(deleteWorkspace(db, otherUserId, workspaceId))).toBe(403);
    sqlite
      .prepare(
        "INSERT INTO memberships (id,workspace_id,user_id,role,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .run(missingId, workspaceId, otherUserId, "admin", "t", "t");
    expect(await status(deleteWorkspace(db, otherUserId, workspaceId))).toBe(403);
    sqlite.prepare("UPDATE memberships SET role = 'member' WHERE id = ?").run(missingId);
    expect(await status(deleteWorkspace(db, otherUserId, workspaceId))).toBe(403);
    expect(await status(deleteWorkspace(db, userId, missingId))).toBe(404);
    expect(await status(deleteWorkspace(db, userId, "invalid"))).toBe(404);
    expect(await listWorkspaces(db, userId)).toHaveLength(1);
  });

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
