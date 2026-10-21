import { describe, expect, test } from "vite-plus/test";
import type { Task } from "@/api/generated/models";
import { initialTaskInput, taskInput, taskPatch, validateTaskInput } from "./task-editor";
import { columnTasks, moveDestination } from "./task-position";
import { timelinePlacement } from "./timeline";
import { validateRoadmapName } from "./roadmap";

const task = (id: string, sortOrder: string, status: Task["status"] = "todo"): Task => ({
  id,
  sortOrder,
  status,
  title: id,
  description: "説明",
  priority: "medium",
  assigneeId: null,
  startDate: null,
  dueDate: null,
  labelIds: [],
  commentCount: 0,
  version: 3,
  roadmapId: "0190a000-0000-7000-8000-000000000001",
  workspaceId: "0190a000-0000-7000-8000-000000000002",
  createdBy: "0190a000-0000-7000-8000-000000000003",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("タスク編集", () => {
  test("列からの追加はそのstatusで、優先度は中", () => {
    expect(initialTaskInput("review")).toMatchObject({
      status: "review",
      priority: "medium",
      labelIds: [],
    });
  });
  test("空白タイトル、不正日付、逆転期間は保存しない", () => {
    expect(validateTaskInput({ title: "　 " }).success).toBe(false);
    expect(validateTaskInput({ title: "A", startDate: "2026-02-30" }).success).toBe(false);
    expect(
      validateTaskInput({ title: "A", startDate: "2026-10-22", dueDate: "2026-10-21" }).success,
    ).toBe(false);
  });
  test("PATCHには変更項目だけを送り、nullで解除し、監査情報を含めない", () => {
    const current = task("a", "a0");
    expect(taskPatch(current, { ...taskInput(current), description: null })).toEqual({
      version: 3,
      description: null,
    });
    expect(taskPatch(current, taskInput(current))).toEqual({ version: 3 });
  });
});

describe("ボードの移動", () => {
  const tasks = [task("c", "a2"), task("a", "a0"), task("b", "a1"), task("done", "a0", "done")];
  test("列内はsortOrder順で、移動対象自身を隣接IDから除く", () => {
    expect(columnTasks(tasks, "todo").map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(moveDestination(tasks, "a", "todo", 1)).toEqual({
      status: "todo",
      beforeTaskId: "b",
      afterTaskId: "c",
    });
    expect(moveDestination(tasks, "c", "todo", 0)).toEqual({
      status: "todo",
      beforeTaskId: null,
      afterTaskId: "a",
    });
  });
  test("列間移動は移動先の境界を送り、空の列では両端null", () => {
    expect(moveDestination(tasks, "a", "done", 1)).toEqual({
      status: "done",
      beforeTaskId: "done",
      afterTaskId: null,
    });
    expect(moveDestination(tasks, "a", "review", 0)).toEqual({
      status: "review",
      beforeTaskId: null,
      afterTaskId: null,
    });
  });
});

describe("タイムライン", () => {
  test("同日は1日、両端を含み、期間境界で切り詰める", () => {
    expect(
      timelinePlacement({ startDate: "2026-10-21", dueDate: "2026-10-21" }, "2026-10-21", 28),
    ).toMatchObject({ kind: "bar", left: 0, width: 1 });
    expect(
      timelinePlacement({ startDate: "2026-10-01", dueDate: "2026-11-30" }, "2026-10-21", 28),
    ).toMatchObject({ kind: "bar", left: 0, width: 28, clipped: true });
  });
  test("片方のみはマーカー、未設定と期間外を区別", () => {
    expect(
      timelinePlacement({ startDate: null, dueDate: "2026-10-22" }, "2026-10-21", 28),
    ).toMatchObject({ kind: "bar", left: 1, width: 1, partial: "期限のみ" });
    expect(
      timelinePlacement({ startDate: "2026-10-22", dueDate: null }, "2026-10-21", 28),
    ).toMatchObject({ kind: "bar", partial: "開始日のみ" });
    expect(timelinePlacement({ startDate: null, dueDate: null }, "2026-10-21", 28)).toEqual({
      kind: "unset",
    });
    expect(
      timelinePlacement({ startDate: "2026-10-01", dueDate: "2026-10-20" }, "2026-10-21", 28),
    ).toEqual({ kind: "outside" });
  });
});

test("名称は空白のみを拒否し、OpenAPIと同じ文字数上限で検証", () => {
  expect(validateRoadmapName("　 ").ok).toBe(false);
  expect(validateRoadmapName("  A  ")).toEqual({ ok: true, name: "A" });
  expect(validateRoadmapName("a".repeat(201)).ok).toBe(false);
});
