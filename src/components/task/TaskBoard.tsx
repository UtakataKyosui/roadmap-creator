import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateKeyBetween } from "fractional-indexing";
import { useRef, useState } from "react";
import { invalidateTasks } from "@/api/cache";
import { apiErrorMessage } from "@/api/error-message";
import { useUpdateTask } from "@/api/generated/endpoints/tasks/tasks";
import type { TaskStatus } from "@/api/generated/models";
import { roadmapTasksOptions } from "@/api/roadmap-tasks";
import { columnTasks, moveDestination } from "@/domain/task-position";
import { STATUS_LABEL, TASK_STATUSES } from "@/domain/task";
import { useLocalToday } from "@/hooks/use-local-today";
import { useWorkspaceOptions } from "@/hooks/use-workspace-options";
import { ErrorState, LoadingState } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";
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
    <main className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">ボード</h1>
        <Button onClick={() => setSelection({ status: "todo" })} disabled={moving}>
          新しいアイテムを追加
        </Button>
      </div>
      {moving && <p role="status">移動を保存中…</p>}
      {failure && (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          {apiErrorMessage(failure.error)}
          <Button variant="outline" disabled={moving} onClick={() => void move(failure.move)}>
            再試行
          </Button>
        </div>
      )}
      {options.error && (
        <p role="status" className="text-sm">
          担当者・ラベルの表示を取得できませんでした。
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              className="min-w-0 rounded-xl bg-secondary/50 p-3"
              onDragOver={(e) => {
                if (dragging && !moving) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging && !moving)
                  drop(dragging, column.filter((t) => t.id !== dragging).length);
              }}
            >
              <h2 className="mb-3 flex justify-between text-sm font-semibold">
                <span>{STATUS_LABEL[status]}</span>
                <span aria-label="タスク数">{column.length}</span>
              </h2>
              <ol className="space-y-3">
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
                    />
                    <div className="mt-1 flex items-center gap-1">
                      <label className="sr-only" htmlFor={`status-${task.id}`}>
                        「{task.title}」のステータス
                      </label>
                      <select
                        id={`status-${task.id}`}
                        value={task.status}
                        disabled={moving}
                        className="min-w-0 flex-1 rounded border bg-background p-1 text-xs"
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
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`「${task.title}」を上へ`}
                        disabled={moving || index === 0}
                        onClick={() => void move({ taskId: task.id, status, index: index - 1 })}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`「${task.title}」を下へ`}
                        disabled={moving || index === column.length - 1}
                        onClick={() => void move({ taskId: task.id, status, index: index + 1 })}
                      >
                        ↓
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              {column.length === 0 && (
                <p className="my-4 text-sm text-muted-foreground">タスクがありません</p>
              )}
              <Button
                variant="ghost"
                className="mt-3 w-full"
                disabled={moving}
                onClick={() => setSelection({ status })}
              >
                ＋ アイテムを追加
              </Button>
            </section>
          );
        })}
      </div>
      {selection && (
        <TaskEditor scope={scope} selection={selection} onClose={() => setSelection(null)} />
      )}
    </main>
  );
}
