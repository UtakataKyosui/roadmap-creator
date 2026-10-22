import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarOff,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { Task } from "@roadmapper/api-contract/models";
import { roadmapTasksOptions } from "@/api/roadmap-tasks";
import { addDays, parseCalendarDate } from "@roadmapper/domain/calendar-date";
import { useLocalToday } from "@/hooks/use-local-today";
import { timelinePlacement } from "@roadmapper/domain/timeline";
import { STATUS_ACCENT, STATUS_LABEL, STATUS_TONE } from "@roadmapper/domain/task";
import { useWorkspaceOptions } from "@/hooks/use-workspace-options";
import { PageHeader } from "@/components/layout/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { PriorityBadge } from "./badges";
import { TaskEditor, type EditorSelection, type TaskScope } from "./TaskEditor";

const DAYS = 28;
const CELL = 30;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const dayInfo = (date: string) => {
  const time = parseCalendarDate(date);
  const value = time === null ? null : new Date(time);
  return {
    month: value ? value.getUTCMonth() + 1 : 0,
    day: value ? value.getUTCDate() : 0,
    weekday: value ? value.getUTCDay() : 0,
  };
};

const formatRange = (date: string) => date.replaceAll("-", "/");

export function TaskTimeline({ scope, initialToday }: { scope: TaskScope; initialToday: string }) {
  const query = useQuery(roadmapTasksOptions(scope.workspaceId, scope.roadmapId));
  const options = useWorkspaceOptions(scope.workspaceId);
  const today = useLocalToday(initialToday);
  const [offset, setOffset] = useState(0);
  const start = addDays(today, offset);
  const end = addDays(start, DAYS - 1);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const days = Array.from({ length: DAYS }, (_, i) => {
    const date = addDays(start, i);
    const info = dayInfo(date);
    return {
      date,
      ...info,
      today: date === today,
      weekend: info.weekday === 0 || info.weekday === 6,
    };
  });
  const shade = (day: (typeof days)[number]) =>
    day.today ? "bg-indigo/5" : day.weekend ? "bg-surface-sunken" : undefined;

  return (
    <>
      <PageHeader
        title="学習スケジュール"
        description="28日間の学習予定。各ステップから期間を設定できます"
        actions={
          <>
            <div
              role="group"
              aria-label="表示期間"
              className="flex overflow-hidden rounded-sm border border-border-strong bg-surface text-xs font-semibold [&>button]:flex [&>button]:h-[34px] [&>button]:items-center [&>button]:gap-1 [&>button]:px-3 [&>button:hover]:bg-surface-subtle [&>button+button]:border-l [&>button+button]:border-border-strong"
            >
              <button type="button" onClick={() => setOffset(offset - DAYS)}>
                <ChevronLeft aria-hidden className="size-3.5" />
                前へ
              </button>
              <button type="button" onClick={() => setOffset(0)}>
                今日
              </button>
              <button type="button" onClick={() => setOffset(offset + DAYS)}>
                次へ
                <ChevronRight aria-hidden className="size-3.5" />
              </button>
            </div>
            <Button size="lg" onClick={() => setSelection({ status: "todo" })}>
              <Plus aria-hidden />
              ステップを追加
            </Button>
          </>
        }
      />
      <main className="flex flex-1 flex-col gap-3 px-6 py-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <CalendarRange aria-hidden className="size-4 text-subtle-foreground" />
          {formatRange(start)} 〜 {formatRange(end)}
          {query.data && (
            <span className="text-xs font-normal text-subtle-foreground">
              · {query.data.length}件のステップ
            </span>
          )}
        </p>
        {query.isPending ? (
          <LoadingState />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState
            title="学習の予定を立てましょう"
            description="ステップを追加して、取り組む期間を設定してください。"
          />
        ) : (
          <div
            className="max-h-[calc(100dvh-14rem)] overflow-auto rounded-md border bg-surface"
            tabIndex={0}
            role="region"
            aria-label="学習ステップのタイムライン"
          >
            <table
              className="timeline-table w-full table-fixed border-separate border-spacing-0 text-[13px]"
              style={{ "--cells-width": `${DAYS * CELL}px` } as CSSProperties}
            >
              <colgroup>
                <col style={{ width: "var(--task-col)" }} />
                {days.map((day) => (
                  <col key={day.date} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-20 h-12 border-r border-b bg-surface-sunken px-4 text-left text-xs font-semibold text-muted-foreground">
                    学習ステップ
                  </th>
                  {days.map((day, index) => (
                    <th
                      key={day.date}
                      aria-current={day.today ? "date" : undefined}
                      className={cn(
                        "border-r border-b bg-surface-sunken p-0 text-center font-normal last:border-r-0",
                        day.weekend && "bg-surface-subtle",
                        day.today && "bg-indigo-tint text-indigo",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-[9.5px]",
                          day.today ? "text-indigo" : "text-subtle-foreground",
                        )}
                      >
                        {WEEKDAYS[day.weekday]}
                      </span>
                      <span
                        className={cn(
                          "block text-[11px]",
                          day.today ? "font-bold" : "text-muted-foreground",
                        )}
                      >
                        {index === 0 || day.day === 1 ? `${day.month}/${day.day}` : day.day}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.map((task) => {
                  const placement = timelinePlacement(task, start, DAYS);
                  const from = task.startDate ?? task.dueDate;
                  const to = task.dueDate ?? task.startDate;
                  return (
                    <tr key={task.id}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 h-14 border-r border-b bg-surface px-4 text-left font-normal"
                      >
                        <button
                          type="button"
                          className="line-clamp-1 font-semibold break-all hover:text-indigo"
                          onClick={() => setSelection({ taskId: task.id })}
                        >
                          {task.title}
                        </button>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-subtle-foreground">
                          <Avatar
                            className="size-[18px] text-[9px]"
                            user={
                              task.assigneeId ? options.memberById.get(task.assigneeId) : undefined
                            }
                          />
                          <PriorityBadge priority={task.priority} />
                          {STATUS_LABEL[task.status]}
                        </div>
                      </th>
                      <td colSpan={DAYS} className="relative h-14 border-b p-0">
                        <div aria-hidden className="absolute inset-0 flex">
                          {days.map((day) => (
                            <span
                              key={day.date}
                              className={cn("flex-1 border-r last:border-r-0", shade(day))}
                            />
                          ))}
                        </div>
                        {placement.kind === "bar" ? (
                          <TimelineBar
                            task={task}
                            left={placement.left}
                            width={placement.width}
                            partial={placement.partial}
                            startsBefore={!!from && from < start}
                            endsAfter={!!to && to > end}
                            onOpen={() => setSelection({ taskId: task.id })}
                          />
                        ) : (
                          <span className="relative flex items-center gap-1.5 px-3 text-[11px] text-subtle-foreground">
                            {placement.kind === "unset" ? (
                              <>
                                <CalendarOff aria-hidden className="size-3.5" />
                                日付未設定
                              </>
                            ) : (
                              <>
                                <CalendarClock aria-hidden className="size-3.5" />
                                表示期間外
                              </>
                            )}
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
      </main>
      {selection && (
        <TaskEditor scope={scope} selection={selection} onClose={() => setSelection(null)} />
      )}
    </>
  );
}

function TimelineBar({
  task,
  left,
  width,
  partial,
  startsBefore,
  endsAfter,
  onOpen,
}: {
  task: Task;
  left: number;
  width: number;
  partial: string | null;
  startsBefore: boolean;
  endsAfter: boolean;
  onOpen: () => void;
}) {
  const label = `${task.title}: ${task.startDate ?? "開始日未設定"} 〜 ${task.dueDate ?? "期限未設定"}${startsBefore || endsAfter ? "（期間の一部）" : ""}`;
  const position = { left: `${(left / DAYS) * 100}%`, width: `${(width / DAYS) * 100}%` };
  if (partial) {
    return (
      <span className="absolute inset-y-0 flex items-center" style={{ left: position.left }}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={label}
          className={cn("h-7 rounded-sm border-[1.5px] border-current", STATUS_TONE[task.status])}
          style={{ width: `calc(${CELL}px - 6px)`, marginLeft: 3 }}
        />
        <span className="ml-1.5 text-[11px] font-semibold whitespace-nowrap text-muted-foreground">
          {partial}
        </span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cn(
        "absolute top-1/2 flex h-7 -translate-y-1/2 items-center gap-1 overflow-hidden px-2 text-left text-[11px] font-semibold whitespace-nowrap",
        STATUS_TONE[task.status],
        startsBefore ? "rounded-r-sm" : cn("rounded-sm border-l-3", STATUS_ACCENT[task.status]),
        endsAfter && "rounded-r-none",
      )}
      style={{
        left: startsBefore ? position.left : `calc(${position.left} + 3px)`,
        width: `calc(${position.width} - ${startsBefore || endsAfter ? 3 : 6}px)`,
      }}
    >
      {startsBefore && <ChevronsLeft aria-hidden className="size-3 shrink-0" />}
      {width > 1 && <span className="truncate">{task.title}</span>}
      {endsAfter && <ChevronsRight aria-hidden className="ml-auto size-3 shrink-0" />}
    </button>
  );
}
