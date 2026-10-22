import { createFileRoute, redirect } from "@tanstack/react-router";
import { getListProjectsQueryOptions } from "@/api/generated/endpoints/projects/projects";
import { getListRoadmapsQueryOptions } from "@/api/generated/endpoints/roadmaps/roadmaps";
import { getListWorkspacesQueryOptions } from "@/api/generated/endpoints/workspaces/workspaces";

// 入口。最初のアクティブなProjectの最初のロードマップのマップへ移る。
// ロードマップがなければProjectの画面、Workspaceまたはアクティブなprojectが無ければWorkspaceの作成・選択画面へ移る。
export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    const workspaces = await queryClient.ensureQueryData(getListWorkspacesQueryOptions());
    if (workspaces.status !== 200 || workspaces.data.length === 0) {
      throw redirect({ to: "/workspaces" });
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
        to: "/w/$workspaceId/p/$projectId/r/$roadmapId/map",
        params: { ...params, roadmapId: roadmap.id },
      });
    }
    throw redirect({ to: "/workspaces" });
  },
});
