import { beforeEach, describe, expect, test } from "vite-plus/test";
import { parseResponse } from "../api/validation";
import { GetRoadmapResponse } from "../api/generated/zod/roadmaps/roadmaps.zod";
import {
  CreateTaskResponse,
  ListTasksResponse,
  UpdateTaskResponse,
} from "../api/generated/zod/tasks/tasks.zod";
import { devFixtures } from "../../db/dev-fixtures";
import { createRoadmap, getRoadmap, listRoadmaps, updateRoadmap } from "./roadmaps";
import { createTask, deleteTask, getTask, listTasks, updateTask } from "./tasks";
import { handle } from "./http";
import {
  createTestDb,
  otherUserId,
  otherWorkspaceId,
  otherWorkspaceProjectId,
  seedTestDb,
} from "./testing/test-db";

const { userId, workspaceId, projectId } = devFixtures;
const labelA = "0190a000-0000-7000-8000-0000000000a1";
const labelB = "0190a000-0000-7000-8000-0000000000a2";
const foreignLabel = "0190a000-0000-7000-8000-0000000000b1";
const missingId = "0190a000-0000-7000-8000-0000000000ff";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];
let roadmapId: string;

beforeEach(async () => {
  ({ db, sqlite } = createTestDb());
  seedTestDb(sqlite);
  const now = "2026-01-01T00:00:00.000Z";
  for (const [id, ws, name] of [
    [labelA, workspaceId, "A"],
    [labelB, workspaceId, "B"],
    [foreignLabel, otherWorkspaceId, "他"],
  ]) {
    sqlite
      .prepare(
        "INSERT INTO labels (id,workspace_id,name,color,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .run(id, ws, name, "#112233", now, now);
  }
  roadmapId = (
    (await createRoadmap(db, userId, workspaceId, projectId, { name: "基礎" })) as { id: string }
  ).id;
});

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error: { status?: number }) => error.status ?? 500,
  );

const details = (promise: Promise<unknown>) =>
  promise.then(
    () => [],
    (error: { details?: { path: string }[] }) => (error.details ?? []).map((d) => d.path),
  );

describe("ロードマップ", () => {
  test("作成→取得→更新→再取得で保存内容が残り、サーバーが管理する項目が設定される", async () => {
    const created = await createRoadmap(db, userId, workspaceId, projectId, {
      name: "新しい",
      description: "説明",
      id: "client-supplied",
      createdBy: otherUserId,
    });
    expect(created).toMatchObject({
      workspaceId,
      projectId,
      name: "新しい",
      description: "説明",
      createdBy: userId,
      version: 1,
      archivedAt: null,
    });
    expect(created.id).not.toBe("client-supplied");
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);

    const updated = await updateRoadmap(db, userId, workspaceId, created.id, {
      version: 1,
      name: "改名",
      description: null,
    });
    expect(updated).toMatchObject({ name: "改名", description: null, version: 2 });

    const fetched = await getRoadmap(db, userId, workspaceId, created.id);
    expect(fetched).toEqual(updated);
    expect((await listRoadmaps(db, userId, workspaceId, projectId)).map((r) => r.id)).toContain(
      created.id,
    );
  });

  test("古いversionでの更新は409で、内容を上書きしない", async () => {
    const before = await getRoadmap(db, userId, workspaceId, roadmapId);
    await updateRoadmap(db, userId, workspaceId, roadmapId, { version: 1, name: "先に更新" });
    expect(
      await status(
        updateRoadmap(db, userId, workspaceId, roadmapId, { version: 1, name: "後から" }),
      ),
    ).toBe(409);
    const after = await getRoadmap(db, userId, workspaceId, roadmapId);
    expect(after.name).toBe("先に更新");
    expect(after.version).toBe(before.version + 1);
  });

  test("入力が不正なら422で項目ごとの理由を返す", async () => {
    const promise = createRoadmap(db, userId, workspaceId, projectId, { name: "" });
    expect(await details(promise)).toEqual(["/name"]);
    expect(await status(createRoadmap(db, userId, workspaceId, projectId, "x"))).toBe(422);
    expect(
      await status(updateRoadmap(db, userId, workspaceId, roadmapId, { name: "version無し" })),
    ).toBe(422);
  });

  test("存在しないIDは404、UUIDでないIDも404", async () => {
    expect(await status(getRoadmap(db, userId, workspaceId, missingId))).toBe(404);
    expect(await status(getRoadmap(db, userId, workspaceId, "abc"))).toBe(404);
    expect(await status(updateRoadmap(db, userId, workspaceId, missingId, { version: 1 }))).toBe(
      404,
    );
    expect(await status(listRoadmaps(db, userId, workspaceId, missingId))).toBe(404);
    expect(await status(getRoadmap(db, userId, missingId, roadmapId))).toBe(404);
  });

  test("Workspaceのメンバーでなければ403、別Workspaceのプロジェクトは404", async () => {
    expect(await status(getRoadmap(db, otherUserId, workspaceId, roadmapId))).toBe(403);
    expect(
      await status(createRoadmap(db, otherUserId, workspaceId, projectId, { name: "x" })),
    ).toBe(403);
    expect(
      await status(createRoadmap(db, userId, workspaceId, otherWorkspaceProjectId, { name: "x" })),
    ).toBe(404);
    expect(await status(getRoadmap(db, userId, otherWorkspaceId, roadmapId))).toBe(403);
  });
});

const makeTask = (body: Record<string, unknown>) =>
  createTask(db, userId, workspaceId, roadmapId, body);
const titles = async (query = "") =>
  (await listTasks(db, userId, workspaceId, roadmapId, new URLSearchParams(query))).items.map(
    (t) => t.title,
  );

describe("タスクの作成と取得", () => {
  test("作成→取得で保存内容が残り、IDと作成者と日時と順序はサーバーが決める", async () => {
    const created = await makeTask({
      title: "基礎を学ぶ",
      priority: "high",
      startDate: "2026-02-01",
      dueDate: "2026-02-10",
      labelIds: [labelB, labelA, labelA],
      id: "client",
      createdBy: otherUserId,
      sortOrder: "zzz",
      version: 9,
    });
    expect(created).toMatchObject({
      roadmapId,
      workspaceId,
      title: "基礎を学ぶ",
      description: null,
      status: "todo",
      priority: "high",
      assigneeId: null,
      startDate: "2026-02-01",
      dueDate: "2026-02-10",
      labelIds: [labelA, labelB],
      commentCount: 0,
      createdBy: userId,
      version: 1,
    });
    expect(created.id).not.toBe("client");
    expect(created.sortOrder).not.toBe("zzz");
    expect(await getTask(db, userId, workspaceId, roadmapId, created.id)).toEqual(created);
  });

  test("sortOrderは同じstatus列の末尾に採番される", async () => {
    const a = await makeTask({ title: "a" });
    const b = await makeTask({ title: "b" });
    const c = await makeTask({ title: "c", status: "done" });
    expect(a.sortOrder < b.sortOrder).toBe(true);
    expect(c.sortOrder).toBe(a.sortOrder);
    expect(await titles()).toEqual(["a", "c", "b"]);
  });

  test("commentCountはコメントの件数から算出される", async () => {
    const task = await makeTask({ title: "t" });
    sqlite
      .prepare(
        "INSERT INTO comments (id,task_id,author_id,body,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .run("0190a000-0000-7000-8000-0000000000c1", task.id, userId, "メモ", "t", "t");
    expect((await getTask(db, userId, workspaceId, roadmapId, task.id)).commentCount).toBe(1);
  });

  test("入力検証: 必須・日付の前後・別Workspaceの担当者とラベル", async () => {
    expect(await details(makeTask({ title: "" }))).toEqual(["/title"]);
    expect(await details(makeTask({ title: "x", status: "bogus" }))).toEqual(["/status"]);
    expect(
      await details(makeTask({ title: "x", startDate: "2026-03-01", dueDate: "2026-02-01" })),
    ).toEqual(["/dueDate"]);
    expect(await details(makeTask({ title: "x", assigneeId: otherUserId }))).toEqual([
      "/assigneeId",
    ]);
    expect(await details(makeTask({ title: "x", labelIds: [labelA, foreignLabel] }))).toEqual([
      "/labelIds/1",
    ]);
    expect(
      await details(
        makeTask({
          title: "x",
          labelIds: Array.from(
            { length: 51 },
            (_, i) => `0190a000-0000-7000-8000-${String(i).padStart(12, "0")}`,
          ),
        }),
      ),
    ).toEqual(["/labelIds"]);
    expect(await titles()).toEqual([]);
  });

  test("存在しないロードマップは404、メンバーでなければ403", async () => {
    expect(await status(createTask(db, userId, workspaceId, missingId, { title: "x" }))).toBe(404);
    expect(await status(createTask(db, otherUserId, workspaceId, roadmapId, { title: "x" }))).toBe(
      403,
    );
    expect(await status(getTask(db, userId, workspaceId, roadmapId, missingId))).toBe(404);
  });
});

describe("タスクの更新", () => {
  test("部分更新: 省略は据え置き、nullは未設定化し、versionが進む", async () => {
    const task = await makeTask({
      title: "t",
      description: "d",
      dueDate: "2026-02-10",
      assigneeId: userId,
      labelIds: [labelA],
    });
    const updated = await updateTask(db, userId, workspaceId, roadmapId, task.id, {
      version: 1,
      description: null,
      priority: "urgent",
    });
    expect(updated).toMatchObject({
      title: "t",
      description: null,
      priority: "urgent",
      dueDate: "2026-02-10",
      assigneeId: userId,
      labelIds: [labelA],
      version: 2,
    });
    expect(updated.sortOrder).toBe(task.sortOrder);
    expect(await getTask(db, userId, workspaceId, roadmapId, task.id)).toEqual(updated);
  });

  test("日付は片方だけの更新でも現在値と合わせて検証する", async () => {
    const task = await makeTask({ title: "t", dueDate: "2026-02-10" });
    expect(
      await details(
        updateTask(db, userId, workspaceId, roadmapId, task.id, {
          version: 1,
          startDate: "2026-03-01",
        }),
      ),
    ).toEqual(["/dueDate"]);
  });

  test("ラベルは差し替えられ、別Workspaceのラベルは422", async () => {
    const task = await makeTask({ title: "t", labelIds: [labelA] });
    const updated = await updateTask(db, userId, workspaceId, roadmapId, task.id, {
      version: 1,
      labelIds: [labelB],
    });
    expect(updated.labelIds).toEqual([labelB]);
    expect(
      (await updateTask(db, userId, workspaceId, roadmapId, task.id, { version: 2, labelIds: [] }))
        .labelIds,
    ).toEqual([]);
    expect(
      await details(
        updateTask(db, userId, workspaceId, roadmapId, task.id, {
          version: 3,
          labelIds: [foreignLabel],
        }),
      ),
    ).toEqual(["/labelIds/0"]);
  });

  test("古いversionなら409で、ラベルも変更されない", async () => {
    const task = await makeTask({ title: "t", labelIds: [labelA] });
    await updateTask(db, userId, workspaceId, roadmapId, task.id, {
      version: 1,
      title: "先に更新",
    });
    // 先の更新でversionは2。versionが一致する値(2)へ進んだ後でも、古い値(1)での更新は無効。
    expect(
      await status(
        updateTask(db, userId, workspaceId, roadmapId, task.id, {
          version: 1,
          title: "後から",
          labelIds: [labelB],
        }),
      ),
    ).toBe(409);
    const after = await getTask(db, userId, workspaceId, roadmapId, task.id);
    expect(after).toMatchObject({ title: "先に更新", labelIds: [labelA], version: 2 });
  });

  test("存在しないタスクは404", async () => {
    expect(
      await status(updateTask(db, userId, workspaceId, roadmapId, missingId, { version: 1 })),
    ).toBe(404);
  });
});

describe("並べ替えと列間移動", () => {
  test("ステータスと並び順を1回で更新できる", async () => {
    const a = await makeTask({ title: "a" });
    const b = await makeTask({ title: "b" });
    const moved = await updateTask(db, userId, workspaceId, roadmapId, a.id, {
      version: 1,
      status: "done",
      beforeTaskId: null,
      afterTaskId: null,
    });
    expect(moved).toMatchObject({ status: "done", version: 2 });
    expect(await titles("status=done")).toEqual(["a"]);
    expect(await titles("status=todo")).toEqual(["b"]);
    expect((await getTask(db, userId, workspaceId, roadmapId, b.id)).version).toBe(1);
  });

  test("列内で直前・直後のタスクの間に入る", async () => {
    const a = await makeTask({ title: "a" });
    const b = await makeTask({ title: "b" });
    const c = await makeTask({ title: "c" });
    await updateTask(db, userId, workspaceId, roadmapId, c.id, {
      version: 1,
      beforeTaskId: a.id,
      afterTaskId: b.id,
    });
    expect(await titles()).toEqual(["a", "c", "b"]);
    await updateTask(db, userId, workspaceId, roadmapId, c.id, {
      version: 2,
      beforeTaskId: null,
      afterTaskId: a.id,
    });
    expect(await titles()).toEqual(["c", "a", "b"]);
    await updateTask(db, userId, workspaceId, roadmapId, c.id, {
      version: 3,
      beforeTaskId: b.id,
      afterTaskId: null,
    });
    expect(await titles()).toEqual(["a", "b", "c"]);
  });

  test("片方だけ指定したときは、その隣の位置に入る", async () => {
    const a = await makeTask({ title: "a" });
    const b = await makeTask({ title: "b" });
    const c = await makeTask({ title: "c" });
    await updateTask(db, userId, workspaceId, roadmapId, c.id, { version: 1, beforeTaskId: a.id });
    expect(await titles()).toEqual(["a", "c", "b"]);
    await updateTask(db, userId, workspaceId, roadmapId, c.id, { version: 2, afterTaskId: b.id });
    expect(await titles()).toEqual(["a", "c", "b"]);
  });

  test("ステータスだけ変えると移動先の列の末尾に入る", async () => {
    const a = await makeTask({ title: "a", status: "review" });
    const b = await makeTask({ title: "b" });
    await updateTask(db, userId, workspaceId, roadmapId, b.id, { version: 1, status: "review" });
    expect(await titles("status=review")).toEqual(["a", "b"]);
    expect(a.sortOrder < (await getTask(db, userId, workspaceId, roadmapId, b.id)).sortOrder).toBe(
      true,
    );
  });

  test("多数回の挿入でも順序が保たれる", async () => {
    const a = await makeTask({ title: "a" });
    const z = await makeTask({ title: "z" });
    let after = z.id;
    const inserted: string[] = [];
    for (let i = 0; i < 12; i++) {
      const t = await makeTask({ title: `n${i}`, status: "review" });
      await updateTask(db, userId, workspaceId, roadmapId, t.id, {
        version: 1,
        status: "todo",
        beforeTaskId: a.id,
        afterTaskId: after,
      });
      after = t.id;
      inserted.push(`n${i}`);
    }
    expect(await titles()).toEqual(["a", ...inserted.toReversed(), "z"]);
  });

  test("移動先の列にないタスクや、自分自身の指定は422", async () => {
    const a = await makeTask({ title: "a" });
    const b = await makeTask({ title: "b", status: "done" });
    expect(
      await details(
        updateTask(db, userId, workspaceId, roadmapId, a.id, {
          version: 1,
          beforeTaskId: b.id,
          afterTaskId: null,
        }),
      ),
    ).toEqual(["/beforeTaskId"]);
    expect(
      await details(
        updateTask(db, userId, workspaceId, roadmapId, a.id, {
          version: 1,
          beforeTaskId: null,
          afterTaskId: a.id,
        }),
      ),
    ).toEqual(["/afterTaskId"]);
    expect(
      await details(
        updateTask(db, userId, workspaceId, roadmapId, a.id, {
          version: 1,
          beforeTaskId: missingId,
          afterTaskId: null,
        }),
      ),
    ).toEqual(["/beforeTaskId"]);
    expect((await getTask(db, userId, workspaceId, roadmapId, a.id)).version).toBe(1);
  });

  test("間に別のタスクがある直前・直後の指定は422", async () => {
    const a = await makeTask({ title: "a" });
    await makeTask({ title: "b" });
    const c = await makeTask({ title: "c" });
    const d = await makeTask({ title: "d" });
    expect(
      await details(
        updateTask(db, userId, workspaceId, roadmapId, d.id, {
          version: 1,
          beforeTaskId: a.id,
          afterTaskId: c.id,
        }),
      ),
    ).toEqual(["/beforeTaskId"]);
    expect(
      await details(
        updateTask(db, userId, workspaceId, roadmapId, d.id, {
          version: 1,
          beforeTaskId: null,
          afterTaskId: c.id,
        }),
      ),
    ).toEqual(["/beforeTaskId"]);
    expect(await titles()).toEqual(["a", "b", "c", "d"]);
  });

  test("順序が逆転した指定や、列が空でないのに先頭かつ末尾の指定は422", async () => {
    const a = await makeTask({ title: "a" });
    const b = await makeTask({ title: "b" });
    const c = await makeTask({ title: "c" });
    expect(
      await status(
        updateTask(db, userId, workspaceId, roadmapId, c.id, {
          version: 1,
          beforeTaskId: b.id,
          afterTaskId: a.id,
        }),
      ),
    ).toBe(422);
    expect(
      await status(
        updateTask(db, userId, workspaceId, roadmapId, c.id, {
          version: 1,
          beforeTaskId: null,
          afterTaskId: null,
        }),
      ),
    ).toBe(422);
  });
});

describe("タスク一覧", () => {
  beforeEach(async () => {
    await makeTask({
      title: "設計",
      priority: "low",
      dueDate: "2026-03-01",
      labelIds: [labelA],
      description: "100%_完了",
    });
    await makeTask({
      title: "実装",
      priority: "urgent",
      dueDate: "2026-02-01",
      status: "in_progress",
      assigneeId: userId,
      labelIds: [labelB],
    });
    await makeTask({ title: "テスト", priority: "high", status: "in_progress" });
  });

  test("既定はsortOrder昇順で、statusの複数指定はORになる", async () => {
    expect(await titles("status=in_progress&status=todo")).toEqual(["設計", "実装", "テスト"]);
    expect(await titles("status=in_progress")).toEqual(["実装", "テスト"]);
  });

  test("担当者・ラベル・検索語で絞り込む", async () => {
    expect(await titles(`assigneeId=${userId}`)).toEqual(["実装"]);
    expect(await titles(`labelId=${labelA}&labelId=${labelB}`)).toEqual(["設計", "実装"]);
    expect(await titles("q=実")).toEqual(["実装"]);
    expect(await titles("q=100%25_")).toEqual(["設計"]);
    expect(await titles("q=%25")).toEqual(["設計"]);
  });

  test("並べ替え: 期限日は未設定を末尾に、優先度は緊急が最大", async () => {
    expect(await titles("sort=dueDate")).toEqual(["実装", "設計", "テスト"]);
    expect(await titles("sort=dueDate&direction=desc")).toEqual(["設計", "実装", "テスト"]);
    expect(await titles("sort=priority&direction=desc")).toEqual(["実装", "テスト", "設計"]);
  });

  test("cursorで続きを取得し、最後のページのnextCursorはnull", async () => {
    const first = await listTasks(
      db,
      userId,
      workspaceId,
      roadmapId,
      new URLSearchParams("limit=2"),
    );
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await listTasks(
      db,
      userId,
      workspaceId,
      roadmapId,
      new URLSearchParams(`limit=2&cursor=${first.nextCursor}`),
    );
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((t) => t.title)).toEqual(await titles());
  });

  test("同じ条件を大量に並べても失敗しない", async () => {
    expect(await titles(`${"status=todo&".repeat(300)}labelId=${labelA}`)).toEqual(["設計"]);
  });

  test("不正なクエリは422", async () => {
    for (const query of [
      "limit=0",
      "limit=201",
      "limit=abc",
      "sort=nope",
      "status=bogus",
      "assigneeId=x",
      "cursor=!!",
      "labelId=x",
    ]) {
      expect(
        await status(listTasks(db, userId, workspaceId, roadmapId, new URLSearchParams(query))),
      ).toBe(422);
    }
  });

  test("別のロードマップのタスクは含まれない", async () => {
    const other = (await createRoadmap(db, userId, workspaceId, projectId, { name: "別" })) as {
      id: string;
    };
    expect(
      (await listTasks(db, userId, workspaceId, other.id, new URLSearchParams())).items,
    ).toEqual([]);
    expect(
      await status(listTasks(db, otherUserId, workspaceId, roadmapId, new URLSearchParams())),
    ).toBe(403);
  });
});

describe("タスクの削除", () => {
  const count = (table: string) =>
    (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

  test("削除すると取得できなくなり、コメントとラベルの紐づけも消える。ほかのタスクは残る", async () => {
    const target = await makeTask({ title: "消す", labelIds: [labelA] });
    const keep = await makeTask({ title: "残す", labelIds: [labelA] });
    sqlite
      .prepare(
        "INSERT INTO comments (id,task_id,author_id,body,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .run("0190a000-0000-7000-8000-0000000000c1", target.id, userId, "メモ", "t", "t");
    sqlite
      .prepare(
        "INSERT INTO comments (id,task_id,author_id,body,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .run("0190a000-0000-7000-8000-0000000000c2", keep.id, userId, "メモ", "t", "t");

    expect(await deleteTask(db, userId, workspaceId, roadmapId, target.id)).toBeUndefined();

    expect(await status(getTask(db, userId, workspaceId, roadmapId, target.id))).toBe(404);
    expect(await titles()).toEqual(["残す"]);
    expect(count("comments")).toBe(1);
    expect(count("task_labels")).toBe(1);
  });

  test("もう一度削除すると404、メンバーでなければ403で削除されない", async () => {
    const task = await makeTask({ title: "t" });
    expect(await status(deleteTask(db, otherUserId, workspaceId, roadmapId, task.id))).toBe(403);
    expect(await titles()).toEqual(["t"]);
    await deleteTask(db, userId, workspaceId, roadmapId, task.id);
    expect(await status(deleteTask(db, userId, workspaceId, roadmapId, task.id))).toBe(404);
    expect(await status(deleteTask(db, userId, workspaceId, roadmapId, "abc"))).toBe(404);
  });

  test("別のロードマップのタスクは削除できない", async () => {
    const other = (await createRoadmap(db, userId, workspaceId, projectId, { name: "別" })) as {
      id: string;
    };
    const task = await makeTask({ title: "t" });
    expect(await status(deleteTask(db, userId, workspaceId, other.id, task.id))).toBe(404);
    expect(await titles()).toEqual(["t"]);
  });
});

describe("DBの失敗", () => {
  test("DBが失敗したら500で、内部の詳細を返さない", async () => {
    const failing = createTestDb({ failOn: /from "tasks"/i });
    seedTestDb(failing.sqlite);
    const response = await handle(() =>
      listTasks(failing.db, userId, workspaceId, devFixtures.roadmapId, new URLSearchParams()),
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as { code: string; message: string };
    expect(body.code).toBe("internal");
    expect(JSON.stringify(body)).not.toContain("simulated");
  });
});

describe("データベースの制約", () => {
  const now = "t";
  const insertRoadmap = (projectId: string, workspaceId: string) =>
    sqlite
      .prepare(
        "INSERT INTO roadmaps (id,project_id,workspace_id,name,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
      )
      .run("0190a000-0000-7000-8000-0000000000d1", projectId, workspaceId, "r", userId, now, now);

  test("プロジェクトと別のWorkspaceを持つロードマップは作れない", () => {
    expect(() => insertRoadmap(projectId, otherWorkspaceId)).toThrow(/FOREIGN KEY/);
    expect(() => insertRoadmap(projectId, workspaceId)).not.toThrow();
  });

  test("Workspaceのメンバーでない担当者や、別Workspaceのラベルは保存できない", async () => {
    const task = await makeTask({ title: "t" });
    expect(() =>
      sqlite.prepare("UPDATE tasks SET assignee_id = ? WHERE id = ?").run(otherUserId, task.id),
    ).toThrow(/FOREIGN KEY/);
    expect(() =>
      sqlite
        .prepare("INSERT INTO task_labels (task_id,label_id,workspace_id) VALUES (?,?,?)")
        .run(task.id, foreignLabel, workspaceId),
    ).toThrow(/FOREIGN KEY/);
    expect(() =>
      sqlite
        .prepare("INSERT INTO task_labels (task_id,label_id,workspace_id) VALUES (?,?,?)")
        .run(task.id, labelA, otherWorkspaceId),
    ).toThrow(/FOREIGN KEY/);
  });
});

describe("応答が契約と一致する", () => {
  test("ロードマップとタスクの応答が生成済みのZodスキーマを満たす", async () => {
    parseResponse(GetRoadmapResponse, await getRoadmap(db, userId, workspaceId, roadmapId));
    const created = await makeTask({ title: "t", labelIds: [labelA], dueDate: "2026-02-01" });
    parseResponse(CreateTaskResponse, created);
    const updated = await updateTask(db, userId, workspaceId, roadmapId, created.id, {
      version: 1,
      status: "review",
    });
    parseResponse(UpdateTaskResponse, updated);
    parseResponse(
      ListTasksResponse,
      await listTasks(db, userId, workspaceId, roadmapId, new URLSearchParams()),
    );
  });
});
