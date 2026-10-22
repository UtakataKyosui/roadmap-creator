import { keepPreviousData } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useListMyTasks } from "@/api/generated/endpoints/my-tasks/my-tasks";
import type { MyTaskItem, MyTaskSummary } from "@/api/generated/models";
import { AppHeader } from "@/components/layout/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/state/StateViews";
import { Avatar } from "@/components/task/Avatar";
import { PriorityBadge, StatusBadge } from "@/components/task/badges";
import { Button } from "@/components/ui/button";
import { formatShortDate, isOverdue } from "@/domain/calendar-date";
import {
  DUE_FILTERS,
  DUE_FILTER_LABEL,
  hasActiveFilters,
  pageCount,
  toApiParams,
  withFilter,
  type MyTasksSearch,
} from "@/domain/my-tasks";
import { STATUS_FILL, STATUS_LABEL, TASK_STATUSES, progressPercent } from "@/domain/task";
import { useLocalToday } from "@/hooks/use-local-today";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-9 rounded-sm border border-border-strong bg-surface-sunken px-3 text-[13px] focus:border-indigo focus:bg-surface focus:outline-none";

export function MyTasksPage({
  search,
  initialToday,
}: {
  search: MyTasksSearch;
  initialToday: string;
}) {
  const navigate = useNavigate({ from: "/my-tasks" });
  const today = useLocalToday(initialToday);
  const query = useListMyTasks(toApiParams(search, today), {
    query: { placeholderData: keepPreviousData },
  });
  const page = query.data?.status === 200 ? query.data.data : undefined;
  const filtered = hasActiveFilters(search);
  const [text, setText] = useState(search.q ?? "");
  useEffect(() => setText(search.q ?? ""), [search.q]);

  const update = (change: Parameters<typeof withFilter>[1]) =>
    navigate({ search: withFilter(search, change), replace: true });
  const clear = () => {
    setText("");
    return navigate({ search: {}, replace: true });
  };
  const goToPage = (next: number) =>
    navigate({ search: { ...search, page: next >= 2 ? next : undefined } });

  // 件数が減って現在のページが範囲外になったときは、最後のページへ戻る。
  const lastPage = page ? pageCount(page.totalCount, page.pageSize) : 1;
  useEffect(() => {
    if (page && page.page > lastPage) {
      void navigate({
        search: { ...search, page: lastPage >= 2 ? lastPage : undefined },
        replace: true,
      });
    }
  }, [page, lastPage, navigate, search]);

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader trail={["マイタスク"]} />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-surface px-6 py-3">
          <h1 className="text-xl font-bold">マイタスク</h1>
          <p className="text-xs text-subtle-foreground">
            自分が担当するタスクを、所属するワークスペースをまたいで表示します。
          </p>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <Summary summary={page?.summary} />
          <Filters
            search={search}
            text={text}
            onTextChange={setText}
            filtered={filtered}
            onChange={update}
            onClear={clear}
          />
          <section aria-label="担当タスク一覧" aria-busy={query.isPlaceholderData}>
            {query.isPending ? (
              <LoadingState label="担当タスクを読み込み中…" />
            ) : query.error || !page ? (
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            ) : page.items.length === 0 ? (
              filtered ? (
                <EmptyState
                  title="条件に一致するタスクがありません"
                  description="検索キーワードやフィルターを変更するか、条件を解除してください。"
                  action={
                    <Button variant="outline" onClick={clear}>
                      <X aria-hidden />
                      条件を解除
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="担当しているタスクはありません"
                  description="ロードマップのタスクの担当者に自分が設定されると、ここに表示されます。"
                />
              )
            ) : (
              <>
                <TaskTable items={page.items} today={today} />
                <Pagination
                  page={page.page}
                  pageSize={page.pageSize}
                  totalCount={page.totalCount}
                  onChange={goToPage}
                />
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Summary({ summary }: { summary: MyTaskSummary | undefined }) {
  const cards: { label: string; value: number | undefined; tone?: string; hint: string }[] = [
    { label: "担当タスク", value: summary?.total, hint: "すべての担当タスク" },
    { label: "進行中", value: summary?.inProgress, hint: "ステータスが進行中" },
    { label: "今週の期限", value: summary?.dueThisWeek, hint: "今日から7日以内・未完了" },
    {
      label: "期限切れ",
      value: summary?.overdue,
      tone: summary?.overdue ? "text-danger" : undefined,
      hint: "期限を過ぎた未完了",
    },
  ];
  return (
    <section aria-label="サマリー" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border bg-surface p-4">
          <p className="text-xs text-subtle-foreground">{card.label}</p>
          <p className={cn("mt-1 text-2xl font-bold", card.tone)}>{card.value ?? "–"}</p>
          <p className="mt-0.5 text-[11px] text-subtle-foreground">{card.hint}</p>
        </div>
      ))}
    </section>
  );
}

function Filters({
  search,
  text,
  onTextChange,
  filtered,
  onChange,
  onClear,
}: {
  search: MyTasksSearch;
  text: string;
  onTextChange: (text: string) => void;
  filtered: boolean;
  onChange: (change: Parameters<typeof withFilter>[1]) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        role="search"
        className="flex min-w-56 flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onChange({ ...search, q: text });
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">キーワード</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground"
          />
          <input
            type="search"
            value={text}
            maxLength={200}
            placeholder="タイトル・説明で検索"
            className={cn(fieldClass, "w-full pl-9")}
            onChange={(event) => onTextChange(event.target.value)}
          />
        </label>
        <Button type="submit" variant="outline" size="lg">
          検索
        </Button>
      </form>
      <Field label="ステータス">
        <select
          className={fieldClass}
          value={search.status ?? ""}
          onChange={(event) =>
            onChange({
              ...search,
              status: (event.target.value || undefined) as MyTasksSearch["status"],
            })
          }
        >
          <option value="">すべて</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="期限">
        <select
          className={fieldClass}
          value={search.due ?? ""}
          onChange={(event) =>
            onChange({ ...search, due: (event.target.value || undefined) as MyTasksSearch["due"] })
          }
        >
          <option value="">すべて</option>
          {DUE_FILTERS.map((due) => (
            <option key={due} value={due}>
              {DUE_FILTER_LABEL[due]}
            </option>
          ))}
        </select>
      </Field>
      <p className="flex h-9 items-center rounded-sm bg-surface-subtle px-3 text-xs text-muted-foreground">
        担当者: 自分
      </p>
      {filtered && (
        <Button variant="ghost" size="lg" onClick={onClear}>
          <X aria-hidden />
          条件を解除
        </Button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}

function TaskTable({ items, today }: { items: MyTaskItem[]; today: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-surface">
      <table className="w-full min-w-[56rem] text-left text-[13px]">
        <thead className="border-b bg-surface-subtle text-xs text-subtle-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              タスク
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              ステータス
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              担当者
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              優先度
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              期限
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              進捗
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <TaskRow key={item.task.id} item={item} today={today} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskRow({ item, today }: { item: MyTaskItem; today: string }) {
  const { task, assignee } = item;
  const overdue = isOverdue(task.dueDate ?? null, task.status, today);
  const progress = progressPercent(task.status);
  return (
    <tr>
      <td className="max-w-80 px-4 py-3">
        <Link
          to="/w/$workspaceId/p/$projectId/r/$roadmapId/board"
          params={{
            workspaceId: task.workspaceId,
            projectId: item.projectId,
            roadmapId: task.roadmapId,
          }}
          className="block truncate font-semibold hover:text-indigo hover:underline"
        >
          {task.title}
        </Link>
        <p className="truncate text-[11px] text-subtle-foreground">
          {item.workspaceName} / {item.projectName} / {item.roadmapName}
        </p>
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={task.status} />
      </td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-2">
          <Avatar user={assignee} />
          <span className="truncate">{assignee.name}</span>
        </span>
      </td>
      <td className="px-3 py-3">
        <PriorityBadge priority={task.priority} />
      </td>
      <td className={cn("px-3 py-3 whitespace-nowrap", overdue && "font-semibold text-danger")}>
        {formatShortDate(task.dueDate ?? null)}
        {overdue && <span className="ml-1 text-[11px]">期限切れ</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            role="progressbar"
            aria-label="進捗"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-subtle"
          >
            <span
              className={cn("block h-full rounded-full", STATUS_FILL[task.status])}
              style={{ width: `${progress}%` }}
            />
          </span>
          <span className="w-9 text-xs text-muted-foreground tabular-nums">{progress}%</span>
        </div>
      </td>
    </tr>
  );
}

function Pagination({
  page,
  pageSize,
  totalCount,
  onChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onChange: (page: number) => void;
}) {
  const last = pageCount(totalCount, pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  return (
    <nav aria-label="ページ送り" className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-subtle-foreground">
        全{totalCount}件中 {from}–{to}件
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft aria-hidden />
          前へ
        </Button>
        <span className="text-xs tabular-nums">
          {page} / {last}
        </span>
        <Button variant="outline" disabled={page >= last} onClick={() => onChange(page + 1)}>
          次へ
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
