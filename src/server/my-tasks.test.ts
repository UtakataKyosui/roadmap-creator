import { beforeEach, describe, expect, test } from "vite-plus/test";
import { parseResponse } from "../api/validation";
import { ListMyTasksResponse } from "../api/generated/zod/my-tasks/my-tasks.zod";
import { devFixtures } from "../../db/dev-fixtures";
import { listMyTasks } from "./my-tasks";
import { createRoadmap } from "./roadmaps";
import { createTask, updateTask } from "./tasks";
import {
  createTestDb,
  otherUserId,
  otherWorkspaceId,
  otherWorkspaceProjectId,
  seedTestDb,
} from "./testing/test-db";

const { userId, workspaceId, projectId } = devFixtures;
const today = "2026-06-10";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];
let roadmapId: string;

const search = (params: Record<string, string | string[]> = {}) => {
  const result = new URLSearchParams({ today });
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : [value]) result.append(key, v);
  }
  return result;
};

const titles = async (params: Record<string, string | string[]> = {}, actor: string = userId) => {
  const page = await listMyTasks(db, actor, search({ pageSize: "100", ...params }));
  return (page.items as { task: { title: string } }[]).map((item) => item.task.title);
};

const add = async (
  title: string,
  extra: { status?: string; dueDate?: string; assigneeId?: string | null; priority?: string } = {},
) => {
  const { status, ...rest } = extra;
  const created = (await createTask(db, userId, workspaceId, roadmapId, {
    title,
    assigneeId: userId,
    ...rest,
  })) as { id: string; version: number };
  if (status) {
    await updateTask(db, userId, workspaceId, roadmapId, created.id, {
      version: created.version,
      status,
    });
  }
  return created;
};

beforeEach(async () => {
  ({ db, sqlite } = createTestDb());
  seedTestDb(sqlite);
  roadmapId = (
    (await createRoadmap(db, userId, workspaceId, projectId, { name: "基礎" })) as { id: string }
  ).id;
});

describe("マイタスク", () => {
  test("自分が担当するタスクだけを返し、未割り当てや他人の担当は含めない", async () => {
    await add("自分");
    await add("未割り当て", { assigneeId: null });
    expect(await titles()).toEqual(["自分"]);
    expect(await titles({}, otherUserId)).toEqual([]);
  });

  test("所属する複数のWorkspaceのタスクを返し、他のユーザーのWorkspaceのタスクは含めない", async () => {
    await add("自分");
    const other = (await createRoadmap(db, otherUserId, otherWorkspaceId, otherWorkspaceProjectId, {
      name: "別",
    })) as { id: string };
    await createTask(db, otherUserId, otherWorkspaceId, other.id, {
      title: "他人のWorkspaceの他人のタスク",
      assigneeId: otherUserId,
    });
    expect(await titles()).toEqual(["自分"]);

    sqlite
      .prepare(
        "INSERT INTO memberships (id,workspace_id,user_id,role,created_at,updated_at) VALUES ('0190a000-0000-7000-8000-0000000000c1',?,?,'member','t','t')",
      )
      .run(otherWorkspaceId, userId);
    await createTask(db, otherUserId, otherWorkspaceId, other.id, {
      title: "別Workspaceの自分のタスク",
      assigneeId: userId,
    });
    expect((await titles()).toSorted()).toEqual(["別Workspaceの自分のタスク", "自分"]);
  });

  test("アーカイブ済みのロードマップのタスクは含めない", async () => {
    await add("対象");
    sqlite.prepare("UPDATE roadmaps SET archived_at = 't' WHERE id = ?").run(roadmapId);
    expect(await titles()).toEqual([]);
  });

  test("キーワード・ステータス・期限を組み合わせて絞り込む", async () => {
    await add("設計レビュー", { status: "review", dueDate: "2026-06-09" });
    await add("設計", { status: "in_progress", dueDate: "2026-06-10" });
    await add("実装", { status: "todo", dueDate: "2026-06-12" });
    await add("完了済みの期限切れ", { status: "done", dueDate: "2026-06-01" });
    await add("期限なし");

    expect(await titles({ q: "設計" })).toEqual(["設計レビュー", "設計"]);
    expect(await titles({ status: ["review", "todo"] })).toEqual([
      "設計レビュー",
      "実装",
      "期限なし",
    ]);
    expect(await titles({ due: "overdue" })).toEqual(["設計レビュー"]);
    expect(await titles({ due: "today" })).toEqual(["設計"]);
    expect(await titles({ due: "thisWeek" })).toEqual(["設計", "実装"]);
    expect(await titles({ due: "noDueDate" })).toEqual(["期限なし"]);
    expect(await titles({ due: ["overdue", "noDueDate"] })).toEqual(["設計レビュー", "期限なし"]);
    expect(await titles({ q: "設計", status: "in_progress", due: "today" })).toEqual(["設計"]);
    expect(await titles({ q: "存在しない" })).toEqual([]);
  });

  test("検索語のワイルドカードは文字として扱う", async () => {
    await add("100%達成");
    await add("1000達成");
    expect(await titles({ q: "100%" })).toEqual(["100%達成"]);
  });

  test("期限の昇順は期限なしを末尾にし、降順でも期限なしは末尾", async () => {
    await add("遅い", { dueDate: "2026-07-01" });
    await add("なし");
    await add("早い", { dueDate: "2026-06-01" });
    expect(await titles()).toEqual(["早い", "遅い", "なし"]);
    expect(await titles({ direction: "desc" })).toEqual(["遅い", "早い", "なし"]);
  });

  test("ページを切り替えても重複・欠落がなく、総件数はページに依らない", async () => {
    for (let i = 1; i <= 7; i++)
      await add(`タスク${i}`, { dueDate: i % 2 ? "2026-06-20" : "2026-06-21" });
    const seen: string[] = [];
    for (const page of [1, 2, 3, 4]) {
      const result = await listMyTasks(db, userId, search({ pageSize: "3", page: String(page) }));
      expect(result.totalCount).toBe(7);
      expect(result.page).toBe(page);
      seen.push(...(result.items as { task: { title: string } }[]).map((i) => i.task.title));
    }
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  test("集計は絞り込みに影響されず、期限切れと今週の期限は完了タスクを除く", async () => {
    await add("a", { status: "todo", dueDate: "2026-06-09" });
    await add("b", { status: "in_progress", dueDate: "2026-06-10" });
    await add("c", { status: "review", dueDate: "2026-06-16" });
    await add("d", { status: "review", dueDate: "2026-06-17" });
    await add("e", { status: "done", dueDate: "2026-06-01" });
    await add("f", { status: "done", dueDate: "2026-06-11" });

    const result = await listMyTasks(db, userId, search({ q: "a" }));
    expect(result.totalCount).toBe(1);
    expect(result.summary).toEqual({
      total: 6,
      todo: 1,
      inProgress: 1,
      review: 2,
      done: 2,
      overdue: 1,
      dueThisWeek: 2,
    });
  });

  test("担当タスクがなければ集計は0で、items は空", async () => {
    const result = await listMyTasks(db, userId, search());
    expect(result).toMatchObject({
      items: [],
      totalCount: 0,
      summary: { total: 0, todo: 0, overdue: 0, dueThisWeek: 0 },
    });
  });

  test("OpenAPIの応答スキーマに一致し、担当者と所属情報を含む", async () => {
    await add("確認", { dueDate: "2026-06-11", priority: "high" });
    const result = await listMyTasks(db, userId, search());
    const parsed = parseResponse(ListMyTasksResponse, JSON.parse(JSON.stringify(result)));
    expect(parsed.items[0]).toMatchObject({
      assignee: { id: userId },
      workspaceName: "開発用",
      projectId,
      projectName: "学習",
      roadmapName: "基礎",
      task: { title: "確認", priority: "high", labelIds: [], commentCount: 0 },
    });
  });

  test("不正な入力は422（today未指定、存在しない日付、範囲外のページ）", async () => {
    const status = (params: URLSearchParams) =>
      listMyTasks(db, userId, params).then(
        () => 200,
        (error: { status?: number }) => error.status ?? 500,
      );
    expect(await status(new URLSearchParams())).toBe(422);
    expect(await status(new URLSearchParams({ today: "2026-02-30" }))).toBe(422);
    expect(await status(search({ page: "0" }))).toBe(422);
    expect(await status(search({ pageSize: "101" }))).toBe(422);
    expect(await status(search({ due: "later" }))).toBe(422);
  });

  test("担当者を指定するパラメータは無視し、他人のタスクに切り替えられない", async () => {
    await add("自分");
    const params = search({ assigneeId: otherUserId });
    const page = await listMyTasks(db, userId, params);
    expect(page.totalCount).toBe(1);
  });
});
