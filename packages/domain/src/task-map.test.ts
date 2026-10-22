import { describe, expect, test } from "vite-plus/test";
import type { Task } from "@roadmapper/api-contract/models";
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
  test("全タスクを一度だけ表示し、線は中央のロードマップから直接つながる", () => {
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
        { source: "summary" },
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

  test("同じキーのタスクも安定して並べる", () => {
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

  test.each([7, 9, 22, 100])("%i件でも状態変更で列へ戻らず、周囲に重ならず分散する", (count) => {
    const tasks = Array.from({ length: count }, (_, i) => task(String(i), "todo"));
    const graph = buildTaskMap(tasks, "計画");
    const changed = buildTaskMap(
      tasks.map((item) => ({ ...item, status: "done" as const })),
      "計画",
    );
    expect(changed.nodes.map((node) => node.position)).toEqual(
      graph.nodes.map((node) => node.position),
    );
    const points = graph.nodes.slice(1).map((node) => node.position);
    expect(points.some((p) => p.x < -140)).toBe(true);
    expect(points.some((p) => p.x > 140)).toBe(true);
    expect(points.some((p) => p.y < -70)).toBe(true);
    expect(points.some((p) => p.y > 70)).toBe(true);
    for (const a of points)
      for (const b of points) {
        if (a === b) continue;
        expect(Math.abs(a.x - b.x) >= 272 || Math.abs(a.y - b.y) >= 180).toBe(true);
      }
  });

  test("0件でも完了率の計算に使う件数が有限で、空の分類に架空タスクを作らない", () => {
    const { nodes, edges } = buildTaskMap([], "新しい計画");
    expect(nodes[0].data).toMatchObject({ total: 0, completed: 0 });
    expect(nodes.filter((node) => node.data.kind === "task")).toHaveLength(0);
    expect(edges.every((edge) => edge.source === "summary")).toBe(true);
  });
});
