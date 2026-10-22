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
import { ErrorState, LoadingState, Notice } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";
import { formatShortDate, isOverdue } from "@roadmapper/domain/calendar-date";
import { buildTaskMap, type RoadmapNode } from "@roadmapper/domain/task-map";
import { STATUS_FILL, STATUS_LABEL, TASK_STATUSES } from "@roadmapper/domain/task";
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
          <GitBranch className="size-3.5" aria-hidden /> GOAL
        </div>
        <h2 className="line-clamp-2 break-words text-sm font-bold" title={data.title}>
          {data.title}
        </h2>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {data.completed} / {data.total} ステップ達成
          </span>
          <span className="font-semibold text-indigo">{percent}%</span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-indigo-tint">
          <div className="h-full rounded-full bg-indigo" style={{ width: `${percent}%` }} />
        </div>
        <Handle id="top" type="source" position={Position.Top} className={port} />
        <Handle id="right" type="source" position={Position.Right} className={port} />
        <Handle id="bottom" type="source" position={Position.Bottom} className={port} />
        <Handle id="left" type="source" position={Position.Left} className={port} />
      </div>
    );
  }
  const { task } = data;
  const { options, today, openTask } = context;
  const assignee = task.assigneeId ? options.memberById.get(task.assigneeId) : undefined;
  const labels = options.labels.filter((label) => task.labelIds.includes(label.id));
  return (
    <article className="w-[252px] rounded-xl border border-border-strong bg-surface p-3.5 shadow-[0_2px_8px_#15181e08] transition-shadow hover:border-indigo/50 hover:shadow-md">
      <Handle
        type="target"
        position={
          data.side === "top"
            ? Position.Top
            : data.side === "bottom"
              ? Position.Bottom
              : data.side === "right"
                ? Position.Right
                : Position.Left
        }
        className={port}
      />
      <div className="mb-2.5 flex items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <span className="ml-auto flex items-center gap-1 text-[10px] text-subtle-foreground">
          <span className={cn("size-1.5 rounded-full", STATUS_FILL[task.status])} />
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
        title="学びのマップ"
        description="目標と学ぶことのつながりを見渡しましょう"
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
              ステップを追加
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
          <div className="mx-5 mb-7 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-surface px-5 py-10 md:mx-7">
            <div className="mb-5 flex items-center gap-3 text-indigo" aria-hidden>
              <span className="size-3 rounded-full border-2 border-indigo/30" />
              <span className="w-10 border-t border-dashed border-indigo/30" />
              <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-tint">
                <GitBranch className="size-6" />
              </span>
              <span className="w-10 border-t border-dashed border-indigo/30" />
              <span className="size-3 rounded-full border-2 border-indigo/30" />
            </div>
            <h2 className="text-lg font-bold">目標への、最初の一歩を。</h2>
            <p className="mt-3 max-w-md text-center text-xs leading-6 text-muted-foreground">
              「参考書の第1章を読む」「単語を30個覚える」など、
              <br className="hidden sm:block" />
              無理なく取り組める大きさで、学ぶことを追加しましょう。
            </p>
            <Button size="lg" className="mt-6" onClick={() => setSelection({ status: "todo" })}>
              <Plus aria-hidden />
              最初のステップを追加
            </Button>
            <div className="mt-10 grid w-full max-w-2xl gap-4 border-t pt-6 sm:grid-cols-3">
              {[
                ["01", "学ぶことを書き出す", "目標に必要な知識や練習を整理。"],
                ["02", "取り組む予定を決める", "スケジュールで無理のない計画に。"],
                ["03", "できたことを記録する", "ステップを完了して、成長を実感。"],
              ].map(([number, title, text]) => (
                <div key={number}>
                  <span className="text-[10px] font-semibold tracking-widest text-indigo">
                    {number}
                  </span>
                  <h3 className="mt-2 text-xs font-semibold">{title}</h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
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
                    bgColor="#F7F8F5"
                    gap={20}
                    size={1}
                  />
                  <Panel
                    position="top-left"
                    className="!m-5 hidden rounded-md border bg-surface/95 px-3.5 py-2.5 shadow-sm sm:block"
                  >
                    <p className="mb-2 text-[11px] font-semibold">ロードマップの全体像</p>
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
                    カードをクリックして、学習内容や進み具合を確認
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
