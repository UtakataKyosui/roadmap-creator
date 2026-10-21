import { CalendarDays, GripVertical, MessageSquare } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import type { Label, Task, User } from "@/api/generated/models";
import { formatShortDate, isOverdue } from "@/domain/calendar-date";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { LabelChip, PriorityBadge } from "./badges";

type Props = {
  task: Task;
  assignee?: Pick<User, "name" | "avatarUrl">;
  labels?: Label[];
  today: string;
  // ドラッグ用のハンドルに渡す属性（ボードが dnd のリスナーを渡す）。
  handleProps?: ComponentPropsWithoutRef<"button">;
  className?: string;
  onOpen?: () => void;
};

// ボードのカード。長いタイトルは2行で省略し、担当者・期限が未設定でも崩れない。
export function TaskCard({
  task,
  assignee,
  labels = [],
  today,
  handleProps,
  className,
  onOpen,
}: Props) {
  const overdue = isOverdue(task.dueDate, task.status, today);
  return (
    <article className={cn("rounded-lg border bg-card p-3 text-sm shadow-xs", className)}>
      <div className="flex items-start gap-2">
        <h3 className="line-clamp-2 min-w-0 flex-1 font-medium break-words">
          {onOpen ? (
            <button type="button" className="text-left hover:underline" onClick={onOpen}>
              {task.title}
            </button>
          ) : (
            task.title
          )}
        </h3>
        <button
          type="button"
          aria-label={`「${task.title}」を移動`}
          className="-m-1 cursor-grab rounded p-1 text-muted-foreground"
          {...handleProps}
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      {labels.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {labels.map((label) => (
            <li key={label.id}>
              <LabelChip name={label.name} color={label.color} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar user={assignee} />
        <span
          className={cn("inline-flex items-center gap-1", overdue && "font-medium text-red-600")}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          <span className="sr-only">期限</span>
          {formatShortDate(task.dueDate)}
          {overdue && <span className="sr-only">（期限超過）</span>}
        </span>
        <PriorityBadge priority={task.priority} />
        <span className="ml-auto inline-flex items-center gap-1">
          <MessageSquare className="size-3.5" aria-hidden />
          <span className="sr-only">コメント</span>
          {task.commentCount}
        </span>
      </div>
    </article>
  );
}
