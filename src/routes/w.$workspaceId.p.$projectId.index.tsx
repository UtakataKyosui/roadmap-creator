import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { getListRoadmapsQueryOptions } from "@/api/generated/endpoints/roadmaps/roadmaps";
import { AppHeader } from "@/components/layout/AppHeader";
import { RoadmapManager } from "@/components/roadmap/RoadmapManager";
import { buildBreadcrumb } from "@/domain/breadcrumb";

const projectRoute = getRouteApi("/w/$workspaceId/p/$projectId");

// ロードマップの一覧・作成・名称編集。
export const Route = createFileRoute("/w/$workspaceId/p/$projectId/")({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(getListRoadmapsQueryOptions(params.workspaceId, params.projectId)),
  component: ProjectPage,
});

function ProjectPage() {
  const { workspaceId, projectId } = Route.useParams();
  const { workspace, project } = projectRoute.useLoaderData();
  const [workspaceName, projectName] = buildBreadcrumb({
    workspace: workspace.name,
    project: project.name,
  });

  return (
    <>
      <AppHeader trail={[workspaceName, projectName]} />
      <main className="p-4">
        <RoadmapManager workspaceId={workspaceId} projectId={projectId} />
      </main>
    </>
  );
}
