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
  review: "振り返り",
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

// 色はui-design.penのステータス色（未着手=グレー、進行中=indigo、レビュー=amber、完了=teal）。
export const STATUS_TONE: Record<TaskStatus, string> = {
  todo: "bg-surface-subtle text-muted-foreground",
  in_progress: "bg-indigo-tint text-indigo",
  review: "bg-amber-tint text-amber",
  done: "bg-teal-tint text-teal",
};

// 列の点、進捗バーなど塗りつぶしに使う色。
export const STATUS_FILL: Record<TaskStatus, string> = {
  todo: "bg-subtle-foreground",
  in_progress: "bg-indigo",
  review: "bg-amber",
  done: "bg-teal",
};

// カード・タイムラインのバーの左端の線。
export const STATUS_ACCENT: Record<TaskStatus, string> = {
  todo: "border-l-subtle-foreground",
  in_progress: "border-l-indigo",
  review: "border-l-amber",
  done: "border-l-teal",
};

export const PRIORITY_TONE: Record<TaskPriority, string> = {
  low: "bg-surface-subtle text-subtle-foreground",
  medium: "bg-surface-subtle text-muted-foreground",
  high: "bg-amber-tint text-amber",
  urgent: "bg-danger-tint text-danger",
};
