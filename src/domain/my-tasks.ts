import type { ListMyTasksParams, MyTaskDueFilter, TaskStatus } from "@/api/generated/models";
import { TASK_STATUSES } from "./task";

export const MY_TASKS_PAGE_SIZE = 20;

export const DUE_FILTERS = [
  "overdue",
  "today",
  "thisWeek",
  "noDueDate",
] as const satisfies readonly MyTaskDueFilter[];

export const DUE_FILTER_LABEL: Record<MyTaskDueFilter, string> = {
  overdue: "期限切れ",
  today: "今日",
  thisWeek: "今週",
  noDueDate: "期限なし",
};

// URLの検索条件。ページ番号は2以上のときだけ持つ。
export type MyTasksSearch = {
  q?: string;
  status?: TaskStatus;
  due?: MyTaskDueFilter;
  page?: number;
};

const oneOf = <T extends string>(values: readonly T[], value: unknown) =>
  values.find((candidate) => candidate === value);

// URLの値はどんな文字列も入り得るため、有効な値だけを取り出す。
export const parseMyTasksSearch = (raw: Record<string, unknown>): MyTasksSearch => {
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 200) : "";
  const status = oneOf(TASK_STATUSES, raw.status);
  const due = oneOf(DUE_FILTERS, raw.due);
  const page = Number(raw.page);
  return {
    ...(q && { q }),
    ...(status && { status }),
    ...(due && { due }),
    ...(Number.isInteger(page) && page >= 2 && { page }),
  };
};

export const hasActiveFilters = (search: MyTasksSearch) =>
  Boolean(search.q || search.status || search.due);

// 条件を変えるときは、ページを1に戻す。
export const withFilter = (search: MyTasksSearch, change: Omit<MyTasksSearch, "page">) =>
  parseMyTasksSearch({ ...search, ...change, page: undefined });

export const toApiParams = (search: MyTasksSearch, today: string): ListMyTasksParams => ({
  today,
  pageSize: MY_TASKS_PAGE_SIZE,
  page: search.page ?? 1,
  ...(search.q && { q: search.q }),
  ...(search.status && { status: [search.status] }),
  ...(search.due && { due: [search.due] }),
});

export const pageCount = (totalCount: number, pageSize: number) =>
  Math.max(1, Math.ceil(totalCount / pageSize));
