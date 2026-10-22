import { CircleAlert, CloudOff, Inbox, Info, LoaderCircle, RefreshCw } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { apiErrorMessage, isRetryable } from "@/api/error-message";
import { Button } from "@roadmapper/ui/components/ui/button";
import { cn } from "@roadmapper/ui/lib/utils";

// 読み込み中・0件・取得失敗を区別して表示する共通部品。
export function LoadingState({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div role="status" className="mx-auto flex w-full max-w-md flex-col gap-2.5 p-8">
      <span
        aria-hidden
        className="h-3 w-44 rounded-full bg-surface-subtle motion-safe:animate-pulse"
      />
      <span
        aria-hidden
        className="h-3 w-full rounded-full bg-surface-subtle motion-safe:animate-pulse"
      />
      <span
        aria-hidden
        className="h-3 w-56 rounded-full bg-surface-subtle motion-safe:animate-pulse"
      />
      <span className="text-center text-xs text-subtle-foreground">{label}</span>
    </div>
  );
}

function StateIcon({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 items-center justify-center rounded-full [&_svg]:size-5",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = <Inbox />,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 p-8 text-center">
      <StateIcon className="bg-indigo-tint text-indigo">{icon}</StateIcon>
      <p className="text-sm font-bold">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-normal text-subtle-foreground">{description}</p>
      )}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2.5 p-8 text-center">
      <StateIcon className="bg-danger-tint text-danger">
        <CloudOff />
      </StateIcon>
      <p className="text-sm font-bold">読み込めませんでした</p>
      <p className="max-w-xs text-xs leading-normal text-subtle-foreground">
        {apiErrorMessage(error)}
      </p>
      {onRetry && isRetryable(error) && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden />
          再試行
        </Button>
      )}
    </div>
  );
}

const NOTICE_TONE = {
  error: ["border-[#f6c9c5] bg-danger-tint text-danger", CircleAlert],
  progress: ["border-transparent bg-indigo-tint font-semibold text-indigo", LoaderCircle],
  info: ["border-transparent bg-surface-subtle text-muted-foreground", Info],
} as const;

// 画面上部に出す1行の通知（保存中、失敗と再試行、補足）。
export function Notice({
  tone,
  children,
  ...props
}: { tone: keyof typeof NOTICE_TONE } & ComponentPropsWithoutRef<"div">) {
  const [className, Icon] = NOTICE_TONE[tone];
  return (
    <div
      {...props}
      className={cn("flex items-center gap-2.5 rounded-sm border px-3 py-2 text-xs", className)}
    >
      <Icon
        aria-hidden
        className={cn("size-4 shrink-0", tone === "progress" && "motion-safe:animate-spin")}
      />
      {children}
    </div>
  );
}
