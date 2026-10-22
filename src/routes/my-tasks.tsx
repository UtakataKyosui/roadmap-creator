import { createFileRoute } from "@tanstack/react-router";
import { getListMyTasksQueryOptions } from "@/api/generated/endpoints/my-tasks/my-tasks";
import { getListWorkspacesQueryOptions } from "@/api/generated/endpoints/workspaces/workspaces";
import { getListProjectsQueryOptions } from "@/api/generated/endpoints/projects/projects";
import { MyTasksPage } from "@/components/my-tasks/MyTasksPage";
import { todayCalendarDate } from "@roadmapper/domain/calendar-date";
import { parseMyTasksSearch, toApiParams } from "@roadmapper/domain/my-tasks";

// ログイン中の利用者が担当するタスクの一覧。条件とページ番号はURLで持つ。
export const Route = createFileRoute("/my-tasks")({
  validateSearch: parseMyTasksSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps }) => {
    const today = todayCalendarDate();
    // 取得に失敗しても画面側でエラー表示と再試行を出すため、ここでは例外にしない。
    const [, workspaces] = await Promise.all([
      queryClient.prefetchQuery(getListMyTasksQueryOptions(toApiParams(deps.search, today))),
      queryClient.fetchQuery(getListWorkspacesQueryOptions()).catch(() => undefined),
    ]);
    const available = workspaces?.status === 200 ? workspaces.data : [];
    const workspace = available.find((item) => item.id === deps.search.workspaceId) ?? available[0];
    const projects = workspace
      ? await queryClient
          .fetchQuery(getListProjectsQueryOptions(workspace.id))
          .catch(() => undefined)
      : undefined;
    const active = projects?.status === 200 ? projects.data.filter((item) => !item.archivedAt) : [];
    const project = active.find((item) => item.id === deps.search.projectId) ?? active[0];
    return { today, workspace, project };
  },
  head: () => ({ meta: [{ title: "マイタスク | Roadmap Studio" }] }),
  component: MyTasksRoute,
});

function MyTasksRoute() {
  const search = Route.useSearch();
  const { today, workspace, project } = Route.useLoaderData();
  return (
    <MyTasksPage search={search} initialToday={today} workspace={workspace} project={project} />
  );
}
