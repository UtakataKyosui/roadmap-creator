import type { TaskPriority, TaskStatus } from "@/api/generated/models";

// ボードの列順。この順序を全画面で共有する。
export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "review",
  "done",
] as const satisfies readonly TaskStatus[];

export const TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const satisfies readonly TaskPriority[];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  review: "レビュー",
  done: "完了",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "緊急",
};

// 進捗率は保存せず、statusから算出する。
const PROGRESS_PERCENT: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 33,
  review: 67,
  done: 100,
};

export const progressPercent = (status: TaskStatus) => PROGRESS_PERCENT[status];

export const STATUS_TONE: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-700",
};

export const PRIORITY_TONE: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-sky-100 text-sky-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};
