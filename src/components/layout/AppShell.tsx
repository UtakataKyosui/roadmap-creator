import { Link, useRouteContext, useRouter, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  LayoutList,
  ListChecks,
  LogOut,
  Sprout,
  Building2,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useState, type ReactNode } from "react";
import { signOut as signOutSession } from "@/api/auth-client";
import { clearUserCache } from "@/api/cache";
import { useListRoadmaps } from "@/api/generated/endpoints/roadmaps/roadmaps";
import { useListWorkspaces } from "@/api/generated/endpoints/workspaces/workspaces";
import { useListProjects } from "@/api/generated/endpoints/projects/projects";
import { Avatar } from "@/components/task/Avatar";
import { Button } from "@/components/ui/button";
import type { View } from "@/domain/breadcrumb";
import { cn } from "@/lib/utils";

type Named = { id: string; name: string };

const navItem =
  "header-nav-link flex items-center gap-2 whitespace-nowrap text-[13px] text-muted-foreground transition-colors hover:text-indigo [&_svg]:size-4 [&_svg]:shrink-0";
const navActive = "is-active font-semibold text-indigo";

// ナビゲーションと現在の場所をヘッダーにまとめた共通の枠。
// パンくずの最後の要素を現在の画面として扱う。
export function AppShell({
  workspace,
  project,
  roadmap,
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
      <AppHeader trail={trail} workspace={workspace} project={project} roadmap={roadmap} />
      <div className="app-content flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}

// 上部バー（ロゴ・パンくず・マイタスクへの導線・ログイン中の利用者）。
export function AppHeader({
  trail,
  workspace,
  project,
  roadmap,
}: {
  trail: ReactNode[];
  workspace?: Named;
  project?: Named;
  roadmap?: Named;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const workspaces = useListWorkspaces();
  const selectedWorkspace = workspace ?? workspaces.data?.data[0];
  const projects = useListProjects(selectedWorkspace?.id ?? "", {
    query: { enabled: !!selectedWorkspace && !project },
  });
  const selectedProject = project ?? projects.data?.data.find((item) => !item.archivedAt);
  const workspacePage = pathname === "/" || pathname === "/workspaces";

  return (
    <header className="app-header shrink-0 border-b bg-surface">
      <div className="header-main">
        <Link
          to="/"
          className="header-brand flex shrink-0 items-center gap-3 text-[15px] font-semibold"
        >
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-indigo text-white">
            <Sprout aria-hidden className="size-4" />
          </span>
          <span>Roadmap Studio</span>
        </Link>
        <nav aria-label="メインナビゲーション" className="header-navigation">
          <Link
            to="/workspaces"
            className={cn(navItem, workspacePage && navActive)}
            aria-current={workspacePage ? "page" : undefined}
          >
            <Building2 aria-hidden />
            ワークスペース
          </Link>
          {selectedWorkspace && selectedProject ? (
            <Link
              to="/w/$workspaceId/p/$projectId"
              params={{ workspaceId: selectedWorkspace.id, projectId: selectedProject.id }}
              className={navItem}
              activeProps={{ className: navActive }}
            >
              <LayoutList aria-hidden />
              ロードマップ
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(navItem, "opacity-50")}
              title="ワークスペースとプロジェクトを作成してください"
            >
              <LayoutList aria-hidden />
              ロードマップ
            </span>
          )}
          <Link
            to="/my-tasks"
            search={{ workspaceId: workspace?.id, projectId: project?.id }}
            className={navItem}
            activeProps={{ className: navActive }}
          >
            <ListChecks aria-hidden />
            マイタスク
          </Link>
          {selectedWorkspace ? (
            <Link
              to="/w/$workspaceId/members"
              params={{ workspaceId: selectedWorkspace.id }}
              search={{ projectId: selectedProject?.id }}
              className={navItem}
              activeProps={{ className: navActive }}
            >
              <Users aria-hidden />
              メンバー
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(navItem, "opacity-50")}
              title="ワークスペースを作成してください"
            >
              <Users aria-hidden />
              メンバー
            </span>
          )}
        </nav>
        <div className="header-account">
          <UserMenu />
        </div>
      </div>
      <div className="header-context">
        <nav aria-label="パンくず" className="min-w-0 flex-1 overflow-hidden">
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
        <RoadmapSwitcher
          workspace={selectedWorkspace}
          project={selectedProject}
          roadmap={roadmap}
        />
      </div>
    </header>
  );
}

// ログイン中の利用者とログアウト。ログアウト後は利用者のキャッシュを破棄してログイン画面へ戻る。
function UserMenu() {
  const { user } = useRouteContext({ from: "__root__" });
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!user) return null;

  const signOut = async () => {
    setPending(true);
    setFailed(false);
    try {
      await signOutSession();
      clearUserCache(queryClient);
      await router.navigate({ to: "/login", replace: true });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      {failed && (
        <span role="alert" className="text-xs text-danger">
          ログアウトできませんでした
        </span>
      )}
      <Avatar user={user} />
      <span className="hidden max-w-32 truncate text-xs lg:inline">{user.name}</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={signOut}
        aria-label="ログアウト"
      >
        <LogOut aria-hidden />
        <span className="hidden sm:inline">ログアウト</span>
      </Button>
    </div>
  );
}

function RoadmapSwitcher({
  workspace,
  project,
  roadmap,
}: {
  workspace?: Named;
  project?: Named;
  roadmap?: Named;
}) {
  const router = useRouter();
  const params = { workspaceId: workspace?.id ?? "", projectId: project?.id ?? "" };
  const enabled = !!workspace && !!project;
  const roadmaps = useListRoadmaps(params.workspaceId, params.projectId, { query: { enabled } });
  const items =
    roadmaps.data?.status === 200 ? roadmaps.data.data.filter((r) => !r.archivedAt) : [];

  return (
    <div className="relative min-w-0 shrink-0">
      <label className="sr-only" htmlFor="header-roadmap">
        ロードマップを切り替え
      </label>
      <select
        id="header-roadmap"
        className="header-roadmap-select h-8 appearance-none rounded-sm border bg-surface py-1 pr-8 pl-3 text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-indigo"
        value={roadmap?.id ?? ""}
        disabled={!enabled || roadmaps.isPending || roadmaps.isError || items.length === 0}
        onChange={(event) => {
          const roadmapId = event.target.value;
          if (roadmapId)
            void router.navigate({
              to: "/w/$workspaceId/p/$projectId/r/$roadmapId/map",
              params: { ...params, roadmapId },
            });
        }}
      >
        <option value="" disabled>
          {!workspace
            ? "ワークスペースを選択"
            : !project
              ? "プロジェクトを選択"
              : roadmaps.isPending
                ? "読み込み中…"
                : roadmaps.isError
                  ? "取得できませんでした"
                  : items.length === 0
                    ? "ロードマップがありません"
                    : "ロードマップを選択"}
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-2 right-2 size-4 text-muted-foreground"
      />
    </div>
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
    <div className="page-header flex min-h-20 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-7 py-4">
      <h2 className="text-base font-bold">{title}</h2>
      {description && <p className="text-xs text-subtle-foreground">{description}</p>}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
