import { createFileRoute, redirect } from "@tanstack/react-router";
import { getListProjectsQueryOptions } from "@/api/generated/endpoints/projects/projects";
import { getListRoadmapsQueryOptions } from "@/api/generated/endpoints/roadmaps/roadmaps";
import { getListWorkspacesQueryOptions } from "@/api/generated/endpoints/workspaces/workspaces";
import { EmptyState } from "@/components/state/StateViews";

// 入口。最初のアクティブなProjectの最初のロードマップのボードへ移る。
// ロードマップがなければProjectの画面（作成導線）、Workspaceまたはアクティブなprojectが無ければ空状態を表示する。
export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    const workspaces = await queryClient.ensureQueryData(getListWorkspacesQueryOptions());
    if (workspaces.status !== 200 || workspaces.data.length === 0) {
      return { empty: "workspace" as const };
    }

    for (const workspace of workspaces.data) {
      const projects = await queryClient.ensureQueryData(getListProjectsQueryOptions(workspace.id));
      const project =
        projects.status === 200 ? projects.data.find((p) => !p.archivedAt) : undefined;
      if (!project) continue;

      const roadmaps = await queryClient.ensureQueryData(
        getListRoadmapsQueryOptions(workspace.id, project.id),
      );
      const roadmap =
        roadmaps.status === 200 ? roadmaps.data.find((r) => !r.archivedAt) : undefined;
      const params = { workspaceId: workspace.id, projectId: project.id };
      if (!roadmap) throw redirect({ to: "/w/$workspaceId/p/$projectId", params });
      throw redirect({
        to: "/w/$workspaceId/p/$projectId/r/$roadmapId/board",
        params: { ...params, roadmapId: roadmap.id },
      });
    }
    return { empty: "project" as const };
  },
  component: Home,
});

function Home() {
  const { empty } = Route.useLoaderData();
  return empty === "workspace" ? (
    <EmptyState
      title="利用できるワークスペースがありません"
      description={
        import.meta.env.DEV
          ? "開発環境では `pnpm db:seed` で開発用のデータを作成してください。"
          : "所属しているワークスペースがありません。ワークスペースのメンバーから招待を受けてください。"
      }
    />
  ) : (
    <EmptyState
      title="利用できるプロジェクトがありません"
      description="ワークスペースにアクティブなプロジェクトがありません。プロジェクトを作成するか、アーカイブを解除してください。"
    />
  );
}
