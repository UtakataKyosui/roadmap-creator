import type { ReactNode } from "react";
import { apiErrorMessage, isRetryable } from "@/api/error-message";
import { Button } from "@/components/ui/button";

// 読み込み中・0件・取得失敗を区別して表示する共通部品。
export function LoadingState({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div role="status" className="p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-8 text-center">
      <p className="font-medium">読み込めませんでした</p>
      <p className="text-sm text-muted-foreground">{apiErrorMessage(error)}</p>
      {onRetry && isRetryable(error) && (
        <Button variant="outline" onClick={onRetry}>
          再試行
        </Button>
      )}
    </div>
  );
}
