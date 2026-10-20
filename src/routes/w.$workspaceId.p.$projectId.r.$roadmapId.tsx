import {
  Link,
  Outlet,
  createFileRoute,
  getRouteApi,
  notFound,
  useRouterState,
} from "@tanstack/react-router";
import { getGetRoadmapQueryOptions } from "@/api/generated/endpoints/roadmaps/roadmaps";
import { ApiError } from "@/api/http";
import { AppHeader } from "@/components/layout/AppHeader";
import { buildBreadcrumb, type View } from "@/domain/breadcrumb";
import { isUuid } from "@/server/ids";

const projectRoute = getRouteApi("/w/$workspaceId/p/$projectId");

// ロードマップの階層。ボードとタイムラインが共有するヘッダーと切り替えを持つ。
export const Route = createFileRoute("/w/$workspaceId/p/$projectId/r/$roadmapId")({
  loader: async ({ context: { queryClient }, params }) => {
    if (!isUuid(params.roadmapId)) throw notFound();
    try {
      const response = await queryClient.ensureQueryData(
        getGetRoadmapQueryOptions(params.workspaceId, params.roadmapId),
      );
      // 別のProjectのロードマップをこのURLで開かせない。
      if (response.status !== 200 || response.data.projectId !== params.projectId) throw notFound();
      return { roadmap: response.data };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  },
  component: RoadmapLayout,
});

const tab = "rounded-md px-3 py-1.5 text-sm";

function RoadmapLayout() {
  const params = Route.useParams();
  const { roadmap } = Route.useLoaderData();
  const { workspace, project } = projectRoute.useLoaderData();
  const view = useRouterState({
    select: (state): View => (state.location.pathname.endsWith("/timeline") ? "timeline" : "board"),
  });
  const [workspaceName, projectName, roadmapName, viewName] = buildBreadcrumb({
    workspace: workspace.name,
    project: project.name,
    roadmap: roadmap.name,
    view,
  });

  return (
    <>
      <AppHeader
        trail={[
          workspaceName,
          <Link
            key="project"
            to="/w/$workspaceId/p/$projectId"
            params={params}
            activeOptions={{ exact: true }}
            className="hover:underline"
          >
            {projectName}
          </Link>,
          roadmapName,
          viewName,
        ]}
      />
      <nav aria-label="表示の切り替え" className="flex gap-1 border-b px-4 py-2">
        <Link
          to="/w/$workspaceId/p/$projectId/r/$roadmapId/board"
          params={params}
          className={tab}
          activeProps={{ className: `${tab} bg-secondary font-medium`, "aria-current": "page" }}
        >
          ボード
        </Link>
        <Link
          to="/w/$workspaceId/p/$projectId/r/$roadmapId/timeline"
          params={params}
          className={tab}
          activeProps={{ className: `${tab} bg-secondary font-medium`, "aria-current": "page" }}
        >
          タイムライン
        </Link>
      </nav>
      <Outlet />
    </>
  );
}
