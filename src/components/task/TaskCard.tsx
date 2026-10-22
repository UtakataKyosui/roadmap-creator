import { CalendarDays, GripVertical, MessageSquare } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { Label, Task, User } from "@roadmapper/api-contract/models";
import { formatShortDate, isOverdue } from "@roadmapper/domain/calendar-date";
import { progressPercent, STATUS_ACCENT, STATUS_FILL } from "@roadmapper/domain/task";
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
  // カード下部の操作（ボードのステータス選択・並べ替えボタン）。
  footer?: ReactNode;
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
  footer,
  className,
  onOpen,
}: Props) {
  const overdue = isOverdue(task.dueDate, task.status, today);
  const progress = progressPercent(task.status);
  return (
    <article
      className={cn(
        "overflow-hidden rounded-md border border-border-strong bg-surface text-[13px] shadow-[0_1px_3px_#15181e14]",
        className,
      )}
    >
      <div className={cn("space-y-2 border-l-3 px-2.5 pt-2.5 pb-2", STATUS_ACCENT[task.status])}>
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            aria-label={`「${task.title}」を移動`}
            className="-ml-1 cursor-grab rounded-sm p-0.5 text-subtle-foreground hover:bg-surface-subtle disabled:cursor-default"
            {...handleProps}
          >
            <GripVertical className="size-3.5" />
          </button>
          <h3 className="line-clamp-2 min-w-0 flex-1 leading-[1.45] font-semibold break-words">
            {onOpen ? (
              <button type="button" className="text-left hover:text-indigo" onClick={onOpen}>
                {task.title}
              </button>
            ) : (
              task.title
            )}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          {labels.length > 0 && (
            <ul className="flex min-w-0 flex-wrap gap-1">
              {labels.map((label) => (
                <li key={label.id}>
                  <LabelChip name={label.name} color={label.color} />
                </li>
              ))}
            </ul>
          )}
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10.5px] text-subtle-foreground">
            <MessageSquare className="size-3" aria-hidden />
            <span className="sr-only">コメント</span>
            {task.commentCount}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-[10.5px] text-subtle-foreground",
              overdue && "font-semibold text-danger",
            )}
          >
            <CalendarDays className="size-3" aria-hidden />
            <span className="sr-only">期限</span>
            {formatShortDate(task.dueDate)}
            {overdue && <span className="sr-only">（期限超過）</span>}
          </span>
          <Avatar user={assignee} />
        </div>
        <div
          role="progressbar"
          aria-label="進捗"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1 overflow-hidden rounded-full bg-surface-subtle"
        >
          <div
            className={cn("h-full rounded-full", STATUS_FILL[task.status])}
            style={{ width: `${progress}%` }}
          />
        </div>
        {footer && <div className="border-t pt-1.5">{footer}</div>}
      </div>
    </article>
  );
}
