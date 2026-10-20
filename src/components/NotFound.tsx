import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/state/StateViews";

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <EmptyState
      title="ページが見つかりません"
      description={
        typeof children === "string"
          ? children
          : "指定された対象が存在しないか、アクセスできません。"
      }
      action={
        <Link to="/" className="text-sm underline">
          トップへ戻る
        </Link>
      }
    />
  );
}
