import type { Edge, Node } from "@xyflow/react";
import type { Task } from "@roadmapper/api-contract/models";

export type MapSide = "top" | "right" | "bottom" | "left";
export type MapNodeData =
  | { kind: "summary"; title: string; total: number; completed: number }
  | { kind: "task"; task: Task; side: MapSide };
export type RoadmapNode = Node<MapNodeData, "roadmap">;

// ステータスで列を作らず、中央のロードマップからタスクを放射状に配置する。
// 線は所属を表し、APIにないタスク間の依存関係は推測しない。
export function buildTaskMap(tasks: Task[], name: string) {
  const nodes: RoadmapNode[] = [
    {
      id: "summary",
      type: "roadmap",
      position: { x: -140, y: -70 },
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
  const ordered = [...tasks].sort((a, b) =>
    a.sortOrder < b.sortOrder ? -1 : a.sortOrder > b.sortOrder ? 1 : a.id.localeCompare(b.id),
  );
  let offset = 0;
  let ring = 0;
  while (offset < ordered.length) {
    const count = Math.min(8 + ring * 6, ordered.length - offset);
    for (let index = 0; index < count; index++) {
      const task = ordered[offset + index];
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
      const x = Math.cos(angle) * (540 + ring * 420);
      const y = Math.sin(angle) * (340 + ring * 280);
      const vertical = Math.abs(Math.sin(angle)) > 0.8;
      const sourceSide: MapSide = vertical ? (y < 0 ? "top" : "bottom") : x < 0 ? "left" : "right";
      const side: MapSide =
        sourceSide === "top"
          ? "bottom"
          : sourceSide === "bottom"
            ? "top"
            : sourceSide === "left"
              ? "right"
              : "left";
      const id = `task:${task.id}`;
      nodes.push({
        id,
        type: "roadmap",
        position: { x: Math.round(x - 126), y: Math.round(y - 80) },
        data: { kind: "task", task, side },
      });
      edges.push({
        id: `summary-${id}`,
        source: "summary",
        sourceHandle: sourceSide,
        target: id,
        type: "default",
      });
    }
    offset += count;
    ring++;
  }
  return { nodes, edges };
}
