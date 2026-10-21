import type { Edge, Node } from "@xyflow/react";
import type { Task, TaskStatus } from "@/api/generated/models";
import { STATUS_LABEL, TASK_STATUSES } from "./task";
import { columnTasks } from "./task-position";

export type MapNodeData =
  | { kind: "summary"; title: string; total: number; completed: number }
  | { kind: "status"; title: string; status: TaskStatus; count: number }
  | { kind: "task"; task: Task };
export type RoadmapNode = Node<MapNodeData, "roadmap">;

// 接続線は「ロードマップ > ステータス > タスク」の所属関係を表す。
// APIにないタスクの依存関係や実行順序を推測しない。
export function buildTaskMap(tasks: Task[], name: string) {
  const nodes: RoadmapNode[] = [
    {
      id: "summary",
      type: "roadmap",
      position: { x: 436, y: 0 },
      draggable: false,
      data: {
        kind: "summary",
        title: name,
        total: tasks.length,
        completed: tasks.filter((task) => task.status === "done").length,
      },
    },
  ];
  const edges: Edge[] = [];
  TASK_STATUSES.forEach((status, column) => {
    const items = columnTasks(tasks, status);
    const groupId = `status:${status}`;
    nodes.push({
      id: groupId,
      type: "roadmap",
      position: { x: column * 300, y: 180 },
      draggable: false,
      data: { kind: "status", title: STATUS_LABEL[status], status, count: items.length },
    });
    edges.push({
      id: `summary-${status}`,
      source: "summary",
      target: groupId,
      targetHandle: "group",
      type: "smoothstep",
    });
    items.forEach((task, row) => {
      const id = `task:${task.id}`;
      nodes.push({
        id,
        type: "roadmap",
        position: { x: column * 300, y: 288 + row * 188 },
        data: { kind: "task", task },
      });
      edges.push({
        id: `${groupId}-${id}`,
        source: groupId,
        sourceHandle: "tasks",
        target: id,
        type: "smoothstep",
      });
    });
  });
  return { nodes, edges };
}
