import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { getListRoadmapsQueryOptions } from "@/api/generated/endpoints/roadmaps/roadmaps";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { RoadmapManager } from "@/components/roadmap/RoadmapManager";
import { buildBreadcrumb } from "@roadmapper/domain/breadcrumb";

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
    <AppShell workspace={workspace} project={project} trail={[workspaceName, projectName]}>
      <PageHeader title="ロードマップ" description="目標を決めて、学びの道筋をつくりましょう" />
      <main className="p-6">
        <RoadmapManager workspaceId={workspaceId} projectId={projectId} />
      </main>
    </AppShell>
  );
}
