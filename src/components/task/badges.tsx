import type { TaskPriority, TaskStatus } from "@roadmapper/api-contract/models";
import { PRIORITY_LABEL, PRIORITY_TONE, STATUS_LABEL, STATUS_TONE } from "@/domain/task";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-semibold";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={cn(base, STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={cn(base, PRIORITY_TONE[priority])}>
      <span className="sr-only">優先度</span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span className={cn(base, "gap-1 border font-normal text-muted-foreground")}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
