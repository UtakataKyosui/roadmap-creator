import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { roadmapTasksOptions } from "@/api/roadmap-tasks";
import { addDays, formatShortDate } from "@/domain/calendar-date";
import { useLocalToday } from "@/hooks/use-local-today";
import { timelinePlacement } from "@/domain/timeline";
import { progressPercent, STATUS_LABEL, STATUS_TONE } from "@/domain/task";
import { useWorkspaceOptions } from "@/hooks/use-workspace-options";
import { EmptyState, ErrorState, LoadingState } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";
import { Avatar } from "./Avatar";
import { PriorityBadge } from "./badges";
import { TaskEditor, type EditorSelection, type TaskScope } from "./TaskEditor";

const DAYS = 28;
const CELL = 36;

export function TaskTimeline({ scope, initialToday }: { scope: TaskScope; initialToday: string }) {
  const query = useQuery(roadmapTasksOptions(scope.workspaceId, scope.roadmapId));
  const options = useWorkspaceOptions(scope.workspaceId);
  const today = useLocalToday(initialToday);
  const [offset, setOffset] = useState(0);
  const start = addDays(today, offset);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <main className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold">タイムライン</h1>
        <Button variant="outline" onClick={() => setOffset(offset - DAYS)}>
          前へ
        </Button>
        <Button variant="outline" onClick={() => setOffset(0)}>
          今日
        </Button>
        <Button variant="outline" onClick={() => setOffset(offset + DAYS)}>
          次へ
        </Button>
        <Button onClick={() => setSelection({ status: "todo" })}>新しいアイテムを追加</Button>
      </div>
      <p className="text-sm">
        {start} 〜 {addDays(start, DAYS - 1)} · 期間はタスク詳細から編集できます。
      </p>
      {query.data.length === 0 ? (
        <EmptyState
          title="タスクがありません"
          description="新しいアイテムを追加して期間を設定してください。"
        />
      ) : (
        <div
          className="max-h-[70dvh] overflow-auto rounded-lg border"
          tabIndex={0}
          role="region"
          aria-label="タスクのタイムライン"
        >
          <table
            className="border-collapse text-sm"
            style={{ width: 360 + DAYS * CELL, minWidth: 360 + DAYS * CELL, tableLayout: "fixed" }}
          >
            <thead className="sticky top-0 z-20 bg-background">
              <tr>
                <th className="sticky left-0 z-20 w-[360px] min-w-[360px] border-b bg-background p-3 text-left">
                  タスク / 担当者 / 優先度
                </th>
                {Array.from({ length: DAYS }, (_, i) => (
                  <th
                    key={i}
                    className="border-b border-l p-1 text-xs font-normal"
                    style={{ minWidth: CELL }}
                  >
                    {formatShortDate(addDays(start, i))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.map((task) => {
                const placement = timelinePlacement(task, start, DAYS);
                return (
                  <tr key={task.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b bg-background p-3 text-left font-normal"
                    >
                      <button
                        className="line-clamp-2 font-medium break-words hover:underline"
                        onClick={() => setSelection({ taskId: task.id })}
                      >
                        {task.title}
                      </button>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <Avatar
                          user={
                            task.assigneeId ? options.memberById.get(task.assigneeId) : undefined
                          }
                        />
                        <PriorityBadge priority={task.priority} />
                        <span>
                          {STATUS_LABEL[task.status]} · {progressPercent(task.status)}%
                        </span>
                      </div>
                    </th>
                    <td
                      colSpan={DAYS}
                      className="relative border-b p-0"
                      style={{
                        width: DAYS * CELL,
                        backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${CELL - 1}px, var(--border) ${CELL - 1}px, var(--border) ${CELL}px)`,
                      }}
                    >
                      {placement.kind === "bar" ? (
                        <button
                          onClick={() => setSelection({ taskId: task.id })}
                          aria-label={`${task.title}: ${task.startDate ?? "開始日未設定"} 〜 ${task.dueDate ?? "期限未設定"}`}
                          className={`absolute top-1/2 h-8 -translate-y-1/2 truncate rounded px-2 text-left text-xs ${STATUS_TONE[task.status]}`}
                          style={{
                            left: `${(placement.left / DAYS) * 100}%`,
                            width: `${(placement.width / DAYS) * 100}%`,
                          }}
                        >
                          {placement.partial ?? (placement.clipped ? "期間の一部" : task.title)}
                        </button>
                      ) : (
                        <span className="px-3 text-xs text-muted-foreground">
                          {placement.kind === "unset" ? "日付未設定" : "表示期間外"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {selection && (
        <TaskEditor scope={scope} selection={selection} onClose={() => setSelection(null)} />
      )}
    </main>
  );
}
