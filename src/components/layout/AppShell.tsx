import { Link } from "@tanstack/react-router";
import { ChartGantt, ChevronRight, LayoutList, Map as MapIcon, SquareKanban } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useListRoadmaps } from "@/api/generated/endpoints/roadmaps/roadmaps";
import type { View } from "@/domain/breadcrumb";
import { cn } from "@/lib/utils";

type Named = { id: string; name: string };

const ROADMAP_DOTS = ["bg-indigo", "bg-teal", "bg-amber"];

const navItem =
  "flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-surface-subtle [&_svg]:size-4 [&_svg]:shrink-0";
const navActive = "bg-indigo-tint font-semibold text-indigo hover:bg-indigo-tint";

// 上部バー（ロゴ・パンくず）と左サイドバーを持つ共通の枠。
// パンくずの最後の要素を現在の画面として扱う。
export function AppShell({
  workspace,
  project,
  roadmap,
  view,
  trail,
  children,
}: {
  workspace: Named;
  project: Named;
  roadmap?: Named;
  view?: View;
  trail: ReactNode[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-surface px-5">
        <Link to="/" className="flex items-center gap-3 text-[15px] font-semibold">
          <span className="flex size-7 items-center justify-center rounded-[8px] bg-indigo text-white">
            <MapIcon aria-hidden className="size-4" />
          </span>
          <span className="hidden sm:inline">Roadmap Studio</span>
        </Link>
        <span aria-hidden className="h-5 w-px bg-border" />
        <nav aria-label="パンくず" className="min-w-0">
          <ol className="flex items-center gap-1.5 text-xs text-subtle-foreground">
            {trail.map((item, index) => {
              const current = index === trail.length - 1;
              return (
                <Fragment key={index}>
                  {index > 0 && <ChevronRight aria-hidden className="size-3 shrink-0" />}
                  <li
                    aria-current={current ? "page" : undefined}
                    className={cn("truncate", current && "font-semibold text-foreground")}
                  >
                    {item}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </nav>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Sidebar workspace={workspace} project={project} roadmap={roadmap} view={view} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function Sidebar({
  workspace,
  project,
  roadmap,
  view,
}: {
  workspace: Named;
  project: Named;
  roadmap?: Named;
  view?: View;
}) {
  const params = { workspaceId: workspace.id, projectId: project.id };
  const roadmaps = useListRoadmaps(workspace.id, project.id);
  const items =
    roadmaps.data?.status === 200 ? roadmaps.data.data.filter((r) => !r.archivedAt) : [];

  return (
    <aside className="flex shrink-0 flex-col gap-1 border-b bg-surface px-3 py-4 md:w-60 md:overflow-y-auto md:border-r md:border-b-0">
      <div className="flex items-center gap-2.5 px-1 pb-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-foreground text-[13px] font-semibold text-white"
        >
          {Array.from(workspace.name)[0]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{workspace.name}</p>
          <p className="truncate text-[11px] text-subtle-foreground">{project.name}</p>
        </div>
      </div>
      <Link
        to="/w/$workspaceId/p/$projectId"
        params={params}
        activeOptions={{ exact: true }}
        className={navItem}
        activeProps={{ className: navActive }}
      >
        <LayoutList aria-hidden />
        ロードマップ一覧
      </Link>
      {roadmap && (
        <nav aria-label="表示の切り替え" className="mt-3 flex flex-col gap-1">
          <p className="truncate px-2.5 pb-1 text-[11px] font-semibold text-subtle-foreground">
            {roadmap.name}
          </p>
          <Link
            to="/w/$workspaceId/p/$projectId/r/$roadmapId/board"
            params={{ ...params, roadmapId: roadmap.id }}
            className={cn(navItem, view === "board" && navActive)}
            aria-current={view === "board" ? "page" : undefined}
          >
            <SquareKanban aria-hidden />
            ボード
          </Link>
          <Link
            to="/w/$workspaceId/p/$projectId/r/$roadmapId/timeline"
            params={{ ...params, roadmapId: roadmap.id }}
            className={cn(navItem, view === "timeline" && navActive)}
            aria-current={view === "timeline" ? "page" : undefined}
          >
            <ChartGantt aria-hidden />
            タイムライン
          </Link>
        </nav>
      )}
      {items.length > 0 && (
        <nav
          aria-label="プロジェクトのロードマップ"
          className="mt-3 hidden flex-col gap-0.5 md:flex"
        >
          <p className="px-2.5 pb-1 text-[11px] font-semibold text-subtle-foreground">
            プロジェクトのロードマップ
          </p>
          {items.map((item, index) => (
            <Link
              key={item.id}
              to="/w/$workspaceId/p/$projectId/r/$roadmapId/board"
              params={{ ...params, roadmapId: item.id }}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-xs text-muted-foreground hover:bg-surface-subtle",
                item.id === roadmap?.id && "bg-surface-subtle font-semibold text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-[7px] shrink-0 rounded-full",
                  ROADMAP_DOTS[index % ROADMAP_DOTS.length],
                )}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          ))}
        </nav>
      )}
    </aside>
  );
}

// 各画面の見出し行。説明文と右端の操作を任意で持つ。
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-surface px-6 py-3">
      <h1 className="text-xl font-bold">{title}</h1>
      {description && <p className="text-xs text-subtle-foreground">{description}</p>}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
