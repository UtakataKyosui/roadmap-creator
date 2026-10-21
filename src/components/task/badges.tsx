import type { TaskPriority, TaskStatus } from "@/api/generated/models";
import { PRIORITY_LABEL, PRIORITY_TONE, STATUS_LABEL, STATUS_TONE } from "@/domain/task";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={cn(base, STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <span className={cn(base, PRIORITY_TONE[priority])}>{PRIORITY_LABEL[priority]}</span>;
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span className={cn(base, "gap-1 border")}>
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
