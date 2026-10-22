import type { Task } from "@roadmapper/api-contract/models";
import { addDays, diffDays } from "./calendar-date";

export const timelinePlacement = (
  task: Pick<Task, "startDate" | "dueDate">,
  start: string,
  days: number,
) => {
  const from = task.startDate ?? task.dueDate;
  const to = task.dueDate ?? task.startDate;
  if (!from || !to) return { kind: "unset" } as const;
  const end = addDays(start, days - 1);
  if (to < start || from > end) return { kind: "outside" } as const;
  const left = Math.max(0, diffDays(start, from) ?? 0);
  const right = Math.min(days - 1, diffDays(start, to) ?? 0);
  return {
    kind: "bar",
    left,
    width: right - left + 1,
    partial: !task.startDate ? "期限のみ" : !task.dueDate ? "開始日のみ" : null,
    clipped: from < start || to > end,
  } as const;
};
