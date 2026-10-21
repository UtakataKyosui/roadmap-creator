import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/state/StateViews";
import { buttonVariants } from "@/components/ui/button";

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-app p-6">
      <EmptyState
        icon={<SearchX />}
        title="ページが見つかりません"
        description={
          typeof children === "string"
            ? children
            : "指定された対象が存在しないか、アクセスできません。"
        }
        action={
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            トップへ戻る
          </Link>
        }
      />
    </div>
  );
}
