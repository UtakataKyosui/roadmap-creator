import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  getListRoadmapsQueryOptions,
  useListRoadmaps,
} from "@/api/generated/endpoints/roadmaps/roadmaps";
import { AppHeader } from "@/components/layout/AppHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/state/StateViews";
import { buildBreadcrumb } from "@/domain/breadcrumb";

const projectRoute = getRouteApi("/w/$workspaceId/p/$projectId");

// ロードマップの一覧。作成・名称編集は #17 で実装する。
export const Route = createFileRoute("/w/$workspaceId/p/$projectId/")({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(getListRoadmapsQueryOptions(params.workspaceId, params.projectId)),
  component: ProjectPage,
});

function ProjectPage() {
  const { workspaceId, projectId } = Route.useParams();
  const { workspace, project } = projectRoute.useLoaderData();
  const roadmaps = useListRoadmaps(workspaceId, projectId);
  const [workspaceName, projectName] = buildBreadcrumb({
    workspace: workspace.name,
    project: project.name,
  });

  return (
    <>
      <AppHeader trail={[workspaceName, projectName]} />
      <main className="p-4">
        {roadmaps.isPending ? (
          <LoadingState />
        ) : roadmaps.error ? (
          <ErrorState error={roadmaps.error} onRetry={() => roadmaps.refetch()} />
        ) : roadmaps.data.status === 200 && roadmaps.data.data.length > 0 ? (
          <ul className="space-y-2">
            {roadmaps.data.data.map((roadmap) => (
              <li key={roadmap.id}>
                <Link
                  to="/w/$workspaceId/p/$projectId/r/$roadmapId/board"
                  params={{ workspaceId, projectId, roadmapId: roadmap.id }}
                  className="underline"
                >
                  {roadmap.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="ロードマップがありません"
            description="作成機能は #17 で追加します。"
          />
        )}
      </main>
    </>
  );
}
