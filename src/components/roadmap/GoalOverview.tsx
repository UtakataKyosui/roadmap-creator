import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  ChartGantt,
  Check,
  Flag,
  GitBranch,
  SquareKanban,
  Target,
} from "lucide-react";
import { useState } from "react";
import { roadmapTasksOptions } from "@/api/roadmap-tasks";
import { Button } from "@/components/ui/button";
import { TaskEditor, type EditorSelection, type TaskScope } from "@/components/task/TaskEditor";
import type { View } from "@/domain/breadcrumb";
import { cn } from "@/lib/utils";
import type { Roadmap } from "@roadmapper/api-contract/models";
import { RoadmapPeriodEditor } from "./RoadmapPeriod";

export function GoalOverview({
  scope,
  name,
  view,
  roadmap,
}: {
  scope: TaskScope & { projectId: string };
  name: string;
  view: View;
  roadmap: Roadmap;
}) {
  const query = useQuery(roadmapTasksOptions(scope.workspaceId, scope.roadmapId));
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const tasks = query.data ?? [];
  const completed = tasks.filter((task) => task.status === "done").length;
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const next =
    tasks.find((task) => task.status === "in_progress") ??
    tasks.find((task) => task.status === "review") ??
    tasks.find((task) => task.status === "todo");
  const ready = query.isSuccess;

  return (
    <section className="goal-overview" aria-label="目標と進み具合">
      <div className="goal-heading">
        <div className="min-w-0">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-indigo">
            <Target className="size-3.5" aria-hidden /> MY ROADMAP
          </p>
          <h1 className="break-words text-2xl font-bold tracking-tight md:text-[28px]">{name}</h1>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            学びたいことを、小さな一歩に。一つずつ、目指す自分へ。
          </p>
          <RoadmapPeriodEditor key={roadmap.id} roadmap={roadmap} />
        </div>
        <span className="goal-emblem" aria-hidden>
          <Flag className="size-8" strokeWidth={1.4} />
        </span>
      </div>
      <div className="goal-stats">
        <div className="goal-progress">
          <div className="mb-3 flex items-center justify-between gap-4 text-xs">
            <span className="font-semibold">目標への進み具合</span>
            <span className="text-muted-foreground">
              {ready ? (
                <>
                  <strong className="text-lg font-semibold text-indigo">
                    {percent}
                    <span className="text-xs">%</span>
                  </strong>
                  <span className="ml-3">
                    {completed} / {tasks.length} ステップ
                  </span>
                </>
              ) : query.isError ? (
                "取得できませんでした"
              ) : (
                "読み込み中…"
              )}
            </span>
          </div>
          <div
            role={ready ? "progressbar" : undefined}
            aria-label="ステップの完了率"
            aria-valuenow={ready ? percent : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 overflow-hidden rounded-full bg-indigo/10"
          >
            <div
              className="h-full rounded-full bg-indigo transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <div className="goal-next">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-tint text-indigo">
            {ready && tasks.length > 0 && !next ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <BookOpen className="size-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground">
              {ready && tasks.length > 0 && !next ? "すべてのステップを達成" : "次の一歩"}
            </p>
            <p className="truncate text-xs font-semibold">
              {!ready
                ? query.isError
                  ? "ステップを取得できませんでした"
                  : "ステップを確認しています"
                : (next?.title ??
                  (tasks.length
                    ? "積み重ねた学びを振り返りましょう"
                    : "最初の学習ステップを決めましょう"))}
            </p>
          </div>
          {ready && (next || !tasks.length) && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={next ? `次の一歩「${next.title}」を開く` : "最初のステップを追加"}
              onClick={() => setSelection(next ? { taskId: next.id } : { status: "todo" })}
            >
              <ArrowUpRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
      <nav className="goal-tabs" aria-label="ロードマップの表示">
        {(
          [
            ["map", "学びのマップ", GitBranch],
            ["board", "ステップ一覧", SquareKanban],
            ["timeline", "学習スケジュール", ChartGantt],
          ] as const
        ).map(([key, label, Icon]) => (
          <Link
            key={key}
            to={`/w/$workspaceId/p/$projectId/r/$roadmapId/${key}`}
            params={scope}
            aria-current={view === key ? "page" : undefined}
            className={cn("goal-tab", view === key && "is-active")}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      {selection && (
        <TaskEditor scope={scope} selection={selection} onClose={() => setSelection(null)} />
      )}
    </section>
  );
}
