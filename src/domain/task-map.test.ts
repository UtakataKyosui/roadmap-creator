import { describe, expect, test } from "vite-plus/test";
import type { Task } from "@/api/generated/models";
import { buildTaskMap } from "./task-map";

const task = (id: string, status: Task["status"], sortOrder = "a0"): Task => ({
  id,
  status,
  sortOrder,
  title: id,
  description: null,
  priority: "medium",
  assigneeId: null,
  startDate: null,
  dueDate: null,
  labelIds: [],
  commentCount: 0,
  version: 1,
  roadmapId: "r",
  workspaceId: "w",
  createdBy: "u",
  createdAt: "2026-10-21T00:00:00Z",
  updatedAt: "2026-10-21T00:00:00Z",
});

describe("マップの所属関係", () => {
  test("全タスクを一度だけ表示し、線は所属するステータスだけを指す", () => {
    const tasks = [
      task("a", "done"),
      task("b", "todo"),
      task("c", "review"),
      task("d", "in_progress"),
    ];
    const graph = buildTaskMap(tasks, "学習計画");
    expect(graph.nodes.filter((node) => node.data.kind === "task")).toHaveLength(tasks.length);
    expect(new Set(graph.nodes.map((node) => node.id)).size).toBe(graph.nodes.length);
    for (const item of tasks) {
      expect(graph.edges.filter((edge) => edge.target === `task:${item.id}`)).toMatchObject([
        { source: `status:${item.status}` },
      ]);
    }
    expect(graph.edges.some((edge) => edge.source.startsWith("task:"))).toBe(false);
    expect(
      graph.edges.every(
        (edge) =>
          graph.nodes.some((node) => node.id === edge.source) &&
          graph.nodes.some((node) => node.id === edge.target),
      ),
    ).toBe(true);
  });

  test("ボードと同じ表示順を使い、同じキーのタスクも安定して並べる", () => {
    const { nodes } = buildTaskMap(
      [task("c", "todo", "a1"), task("b", "todo"), task("a", "todo")],
      "計画",
    );
    expect(nodes.filter((node) => node.data.kind === "task").map((node) => node.id)).toEqual([
      "task:a",
      "task:b",
      "task:c",
    ]);
  });

  test("0件でも完了率の計算に使う件数が有限で、空の分類に架空タスクを作らない", () => {
    const { nodes, edges } = buildTaskMap([], "新しい計画");
    expect(nodes[0].data).toMatchObject({ total: 0, completed: 0 });
    expect(nodes.filter((node) => node.data.kind === "task")).toHaveLength(0);
    expect(edges.every((edge) => edge.source === "summary")).toBe(true);
  });
});
