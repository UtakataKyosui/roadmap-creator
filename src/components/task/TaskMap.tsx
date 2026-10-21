import { useQuery } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useNodesState,
  type NodeProps,
} from "@xyflow/react";
import { CalendarDays, Check, GitBranch, MessageSquare, Plus, RotateCcw } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { roadmapTasksOptions } from "@/api/roadmap-tasks";
import { PageHeader } from "@/components/layout/AppShell";
import { EmptyState, ErrorState, LoadingState, Notice } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";
import { formatShortDate, isOverdue } from "@/domain/calendar-date";
import { buildTaskMap, type RoadmapNode } from "@/domain/task-map";
import { STATUS_ACCENT, STATUS_FILL, STATUS_LABEL, TASK_STATUSES } from "@/domain/task";
import { useLocalToday } from "@/hooks/use-local-today";
import { useWorkspaceOptions } from "@/hooks/use-workspace-options";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { LabelChip, PriorityBadge } from "./badges";
import { TaskEditor, type EditorSelection, type TaskScope } from "./TaskEditor";

type MapContextValue = {
  today: string;
  options: ReturnType<typeof useWorkspaceOptions>;
  openTask: (id: string) => void;
};
const MapContext = createContext<MapContextValue | null>(null);
const port = "!size-2.5 !border-2 !border-white !bg-border-strong";

function MapNode({ data }: NodeProps<RoadmapNode>) {
  const context = useContext(MapContext);
  if (!context) return null;
  if (data.kind === "summary") {
    const percent = data.total ? Math.round((data.completed / data.total) * 100) : 0;
    return (
      <div className="w-[280px] rounded-lg border border-indigo/25 bg-surface p-4 shadow-[0_6px_24px_#4f46e50d]">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-widest text-indigo">
          <GitBranch className="size-3.5" aria-hidden /> ROADMAP
        </div>
        <h2 className="line-clamp-2 break-words text-sm font-bold" title={data.title}>
          {data.title}
        </h2>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {data.completed} / {data.total} タスク完了
          </span>
          <span className="font-semibold text-indigo">{percent}%</span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-indigo-tint">
          <div className="h-full rounded-full bg-indigo" style={{ width: `${percent}%` }} />
        </div>
        <Handle type="source" position={Position.Bottom} className={port} />
      </div>
    );
  }
  if (data.kind === "status") {
    return (
      <div className="flex h-12 w-[252px] items-center gap-2.5 rounded-md border bg-surface px-4 shadow-sm">
        <Handle id="group" type="target" position={Position.Top} className={port} />
        <span className={cn("size-2 rounded-full", STATUS_FILL[data.status])} />
        <h2 className="text-xs font-bold">{data.title}</h2>
        <span className="ml-auto rounded-full bg-surface-subtle px-2 text-[11px] text-muted-foreground">
          {data.count}
        </span>
        <Handle id="tasks" type="source" position={Position.Left} className={port} />
      </div>
    );
  }
  const { task } = data;
  const { options, today, openTask } = context;
  const assignee = task.assigneeId ? options.memberById.get(task.assigneeId) : undefined;
  const labels = options.labels.filter((label) => task.labelIds.includes(label.id));
  return (
    <article
      className={cn(
        "w-[252px] rounded-md border border-l-[3px] bg-surface p-3.5 shadow-[0_2px_8px_#15181e08] transition-shadow hover:shadow-md",
        STATUS_ACCENT[task.status],
      )}
    >
      <Handle type="target" position={Position.Left} className={port} />
      <div className="mb-2.5 flex items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <span className="ml-auto flex items-center gap-1 text-[10px] text-subtle-foreground">
          {task.status === "done" && <Check aria-hidden className="size-3 text-teal" />}
          {STATUS_LABEL[task.status]}
        </span>
      </div>
      <h3>
        <button
          type="button"
          className="nodrag nopan line-clamp-2 text-left text-[13px] font-semibold leading-5 break-words hover:text-indigo focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-indigo"
          onClick={() => openTask(task.id)}
        >
          {task.title}
        </button>
      </h3>
      <div
        className="mt-2 flex h-5 items-center gap-1 overflow-hidden"
        title={labels.map((label) => label.name).join("、")}
      >
        {labels[0] && (
          <span className="min-w-0 overflow-hidden whitespace-nowrap">
            <LabelChip name={labels[0].name} color={labels[0].color} />
          </span>
        )}
        {labels.length > 1 && (
          <span className="shrink-0 text-[10px] text-subtle-foreground">+{labels.length - 1}</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t pt-2.5 text-[10.5px] text-subtle-foreground">
        <span
          className={cn(
            "flex items-center gap-1",
            isOverdue(task.dueDate, task.status, today) && "font-semibold text-danger",
          )}
        >
          <CalendarDays className="size-3" aria-hidden />
          <span className="sr-only">期限</span>
          {formatShortDate(task.dueDate)}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <MessageSquare className="size-3" aria-hidden />
          <span className="sr-only">コメント</span>
          {task.commentCount}
        </span>
        <Avatar user={assignee} />
      </div>
    </article>
  );
}

const nodeTypes = { roadmap: MapNode };
const edgeOptions = {
  style: { stroke: "#9AA5B8", strokeWidth: 2 },
  selectable: false,
  focusable: false,
};

export function TaskMap({
  scope,
  initialToday,
  name,
}: {
  scope: TaskScope;
  initialToday: string;
  name: string;
}) {
  const query = useQuery(roadmapTasksOptions(scope.workspaceId, scope.roadmapId));
  const options = useWorkspaceOptions(scope.workspaceId);
  const today = useLocalToday(initialToday);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [layoutKey, setLayoutKey] = useState(0);
  const graph = useMemo(() => buildTaskMap(query.data ?? [], name), [query.data, name]);
  const [nodes, setNodes, onNodesChange] = useNodesState<RoadmapNode>(graph.nodes);
  // 再取得後も画面内の配置を保ち、追加・削除と編集した内容は同期する。
  useEffect(() => {
    setNodes((before) => {
      const byId = new Map(before.map((node) => [node.id, node]));
      return graph.nodes.map((node) => ({
        ...byId.get(node.id),
        ...node,
        position: byId.get(node.id)?.position ?? node.position,
      }));
    });
  }, [graph.nodes, setNodes]);
  return (
    <>
      <PageHeader
        title="マップ"
        description="全体を見渡し、次の一歩を決めましょう"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setNodes(graph.nodes);
                setLayoutKey((key) => key + 1);
              }}
            >
              <RotateCcw aria-hidden />
              配置を整える
            </Button>
            <Button onClick={() => setSelection({ status: "todo" })}>
              <Plus aria-hidden />
              タスクを追加
            </Button>
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col">
        {query.isPending ? (
          <LoadingState />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState
            title="最初の一歩を追加しましょう"
            description="タスクを追加すると、ロードマップの全体像がここに広がります。"
            icon={<GitBranch />}
            action={
              <Button onClick={() => setSelection({ status: "todo" })}>
                <Plus aria-hidden />
                タスクを追加
              </Button>
            }
          />
        ) : (
          <>
            {options.error && (
              <div className="px-6 pt-3">
                <Notice tone="info" role="status">
                  担当者・ラベルの表示を取得できませんでした。
                </Notice>
              </div>
            )}
            <MapContext.Provider
              value={{ options, today, openTask: (id) => setSelection({ taskId: id }) }}
            >
              <div className="roadmap-flow relative min-h-0 flex-1" aria-label="タスクのマップ">
                <ReactFlow<RoadmapNode>
                  key={layoutKey}
                  nodes={nodes}
                  edges={graph.edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  defaultEdgeOptions={edgeOptions}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  nodesFocusable={false}
                  edgesFocusable={false}
                  deleteKeyCode={null}
                  minZoom={0.15}
                  maxZoom={1.75}
                  fitView
                  fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
                  ariaLabelConfig={{
                    "controls.zoomIn.ariaLabel": "拡大",
                    "controls.zoomOut.ariaLabel": "縮小",
                    "controls.fitView.ariaLabel": "全体を表示",
                    "minimap.ariaLabel": "マップの全体像",
                  }}
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    color="#CED4DF"
                    bgColor="#F6F7F9"
                    gap={20}
                    size={1}
                  />
                  <Panel
                    position="top-left"
                    className="!m-5 hidden rounded-md border bg-surface/95 px-3.5 py-2.5 shadow-sm sm:block"
                  >
                    <p className="mb-2 text-[11px] font-semibold">ステータスで全体を整理</p>
                    <div className="flex flex-wrap gap-3">
                      {TASK_STATUSES.map((status) => (
                        <span
                          key={status}
                          className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                        >
                          <span className={cn("size-1.5 rounded-full", STATUS_FILL[status])} />
                          {STATUS_LABEL[status]}
                        </span>
                      ))}
                    </div>
                  </Panel>
                  <Controls showInteractive={false} aria-label="マップの表示操作" />
                  <MiniMap<RoadmapNode>
                    pannable
                    zoomable
                    nodeColor={(node) =>
                      node.data.kind === "task" && node.data.task.status === "done"
                        ? "#0D9488"
                        : "#A5A0ED"
                    }
                    maskColor="#f6f7f9bb"
                    className="!hidden !overflow-hidden !rounded-md !border !shadow-sm sm:!block"
                  />
                  <Panel
                    position="bottom-center"
                    className="pointer-events-none !mb-5 hidden rounded-full border bg-surface/95 px-4 py-2 text-[10px] text-muted-foreground lg:block"
                  >
                    線は分類を表示 · ドラッグで配置 · 配置はこの画面内のみ
                  </Panel>
                </ReactFlow>
              </div>
            </MapContext.Provider>
          </>
        )}
      </main>
      {selection && (
        <TaskEditor scope={scope} selection={selection} onClose={() => setSelection(null)} />
      )}
    </>
  );
}
