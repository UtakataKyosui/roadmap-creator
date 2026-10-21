import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

// 共通ヘッダー。「Roadmap Studio」とパンくず（最後の要素が現在の画面）を表示する。
export function AppHeader({ trail }: { trail: ReactNode[] }) {
  return (
    <header className="flex items-center gap-4 border-b px-4 py-3">
      <Link to="/" className="font-semibold">
        Roadmap Studio
      </Link>
      <nav aria-label="パンくず">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground">
          {trail.map((item, index) => (
            <Fragment key={index}>
              {index > 0 && <ChevronRight aria-hidden className="size-3.5" />}
              <li aria-current={index === trail.length - 1 ? "page" : undefined}>{item}</li>
            </Fragment>
          ))}
        </ol>
      </nav>
    </header>
  );
}
