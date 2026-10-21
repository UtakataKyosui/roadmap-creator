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
import { AppShell } from "@/components/layout/AppShell";
import { buildBreadcrumb, type View } from "@/domain/breadcrumb";
import { isUuid } from "@/server/ids";

const projectRoute = getRouteApi("/w/$workspaceId/p/$projectId");

// ロードマップの階層。ボードとタイムラインが共有する枠と切り替えを持つ。
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
    <AppShell
      workspace={workspace}
      project={project}
      roadmap={roadmap}
      view={view}
      trail={[
        workspaceName,
        <Link
          key="project"
          to="/w/$workspaceId/p/$projectId"
          params={params}
          activeOptions={{ exact: true }}
          className="hover:text-foreground hover:underline"
        >
          {projectName}
        </Link>,
        roadmapName,
        viewName,
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
