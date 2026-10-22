import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateKeyBetween } from "fractional-indexing";
import { ArrowDown, ArrowUp, ChevronDown, Plus, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { invalidateTasks } from "@/api/cache";
import { apiErrorMessage } from "@/api/error-message";
import { useUpdateTask } from "@/api/generated/endpoints/tasks/tasks";
import type { TaskStatus } from "@roadmapper/api-contract/models";
import { roadmapTasksOptions } from "@/api/roadmap-tasks";
import { columnTasks, moveDestination } from "@/domain/task-position";
import { STATUS_FILL, STATUS_LABEL, TASK_STATUSES } from "@/domain/task";
import { useLocalToday } from "@/hooks/use-local-today";
import { useWorkspaceOptions } from "@/hooks/use-workspace-options";
import { PageHeader } from "@/components/layout/AppShell";
import { ErrorState, LoadingState, Notice } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskCard } from "./TaskCard";
import { TaskEditor, type EditorSelection, type TaskScope } from "./TaskEditor";

type Move = { taskId: string; status: TaskStatus; index: number };

export function TaskBoard({ scope, initialToday }: { scope: TaskScope; initialToday: string }) {
  const client = useQueryClient();
  const queryOptions = roadmapTasksOptions(scope.workspaceId, scope.roadmapId);
  const query = useQuery(queryOptions);
  const options = useWorkspaceOptions(scope.workspaceId);
  const update = useUpdateTask();
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ error: unknown; move: Move } | null>(null);
  const [moving, setMoving] = useState(false);
  const locked = useRef(false);
  const today = useLocalToday(initialToday);

  const move = async (command: Move) => {
    if (locked.current) return;
    locked.current = true;
    setMoving(true);
    setFailure(null);
    await client.cancelQueries({ queryKey: queryOptions.queryKey });
    const before = client.getQueryData(queryOptions.queryKey) ?? [];
    const task = before.find((t) => t.id === command.taskId);
    if (!task) {
      locked.current = false;
      setMoving(false);
      return;
    }
    const destination = moveDestination(before, task.id, command.status, command.index);
    try {
      const lower = before.find((t) => t.id === destination.beforeTaskId)?.sortOrder ?? null;
      const upper = before.find((t) => t.id === destination.afterTaskId)?.sortOrder ?? null;
      const sortOrder = generateKeyBetween(lower, upper);
      client.setQueryData(
        queryOptions.queryKey,
        before.map((t) => (t.id === task.id ? { ...t, status: command.status, sortOrder } : t)),
      );
      await update.mutateAsync({
        ...scope,
        taskId: task.id,
        data: { version: task.version, ...destination },
      });
    } catch (error) {
      client.setQueryData(queryOptions.queryKey, before);
      setFailure({ error, move: command });
    } finally {
      await invalidateTasks(client, scope.workspaceId, scope.roadmapId, task.id);
      locked.current = false;
      setMoving(false);
    }
  };

  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const tasks = query.data;
  return (
    <>
      <PageHeader
        title="学習ステップ"
        description="取り組みを整理して、できたことを増やしましょう"
        actions={
          <Button size="lg" onClick={() => setSelection({ status: "todo" })} disabled={moving}>
            <Plus aria-hidden />
            ステップを追加
          </Button>
        }
      />
      <main className="flex flex-1 flex-col gap-3 px-5 pb-7 md:px-7">
        {moving && (
          <Notice tone="progress" role="status">
            移動を保存中…
          </Notice>
        )}
        {failure && (
          <Notice tone="error" role="alert">
            {apiErrorMessage(failure.error)}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={moving}
              onClick={() => void move(failure.move)}
            >
              <RefreshCw aria-hidden />
              再試行
            </Button>
          </Notice>
        )}
        {options.error && (
          <Notice tone="info" role="status">
            担当者・ラベルの表示を取得できませんでした。
          </Notice>
        )}
        <div className="grid flex-1 grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
          {TASK_STATUSES.map((status) => {
            const column = columnTasks(tasks, status);
            const drop = (taskId: string, index: number) => {
              setDragging(null);
              void move({ taskId, status, index });
            };
            return (
              <section
                key={status}
                aria-label={STATUS_LABEL[status]}
                className="flex min-w-0 flex-col gap-3 rounded-lg border bg-surface-subtle/50 p-3.5"
                onDragOver={(e) => {
                  if (dragging && !moving) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging && !moving)
                    drop(dragging, column.filter((t) => t.id !== dragging).length);
                }}
              >
                <h2 className="flex items-center gap-2 px-0.5 pb-1 text-[13px] font-bold">
                  <span aria-hidden className={cn("size-2 rounded-full", STATUS_FILL[status])} />
                  <span>{STATUS_LABEL[status]}</span>
                  <span
                    aria-label="タスク数"
                    className="rounded-full bg-surface-subtle px-[7px] text-[11px] font-semibold text-muted-foreground"
                  >
                    {column.length}
                  </span>
                </h2>
                <ol className="space-y-2.5">
                  {column.map((task, index) => (
                    <li
                      key={task.id}
                      onDragOver={(e) => {
                        if (dragging && !moving) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragging && dragging !== task.id && !moving) {
                          const at = column
                            .filter((t) => t.id !== dragging)
                            .findIndex((t) => t.id === task.id);
                          drop(dragging, at);
                        }
                      }}
                    >
                      <TaskCard
                        task={task}
                        today={today}
                        className={cn(dragging === task.id && "opacity-50")}
                        assignee={
                          task.assigneeId ? options.memberById.get(task.assigneeId) : undefined
                        }
                        labels={options.labels.filter((label) => task.labelIds.includes(label.id))}
                        onOpen={() => setSelection({ taskId: task.id })}
                        handleProps={{
                          draggable: !moving,
                          disabled: moving,
                          onDragStart: (e) => {
                            e.dataTransfer.setData("text/plain", task.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragging(task.id);
                          },
                          onDragEnd: () => setDragging(null),
                        }}
                        footer={
                          <div className="flex items-center gap-1">
                            <label className="sr-only" htmlFor={`status-${task.id}`}>
                              「{task.title}」のステータス
                            </label>
                            <span className="relative">
                              <select
                                id={`status-${task.id}`}
                                value={task.status}
                                disabled={moving}
                                className="h-6 appearance-none rounded-sm border bg-surface pr-6 pl-2 text-[11px] text-muted-foreground hover:border-border-strong"
                                onChange={(e) => {
                                  const next = TASK_STATUSES.find((s) => s === e.target.value);
                                  if (next)
                                    void move({
                                      taskId: task.id,
                                      status: next,
                                      index: columnTasks(tasks, next).length,
                                    });
                                }}
                              >
                                {TASK_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {STATUS_LABEL[s]}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                aria-hidden
                                className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-subtle-foreground"
                              />
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="ml-auto"
                              aria-label={`「${task.title}」を上へ`}
                              disabled={moving || index === 0}
                              onClick={() =>
                                void move({ taskId: task.id, status, index: index - 1 })
                              }
                            >
                              <ArrowUp aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`「${task.title}」を下へ`}
                              disabled={moving || index === column.length - 1}
                              onClick={() =>
                                void move({ taskId: task.id, status, index: index + 1 })
                              }
                            >
                              <ArrowDown aria-hidden />
                            </Button>
                          </div>
                        }
                      />
                    </li>
                  ))}
                </ol>
                {column.length === 0 && (
                  <p className="py-3 text-center text-xs text-subtle-foreground">
                    {status === "todo"
                      ? "これから学びたいことを追加"
                      : status === "in_progress"
                        ? "取り組み始めたら、ここへ"
                        : status === "review"
                          ? "学んだことを、もう一度確認"
                          : "できたことを積み重ねよう"}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="h-[34px] w-full text-xs font-semibold text-muted-foreground"
                  disabled={moving}
                  onClick={() => setSelection({ status })}
                >
                  ＋ ステップを追加
                </Button>
              </section>
            );
          })}
        </div>
      </main>
      {selection && (
        <TaskEditor scope={scope} selection={selection} onClose={() => setSelection(null)} />
      )}
    </>
  );
}
