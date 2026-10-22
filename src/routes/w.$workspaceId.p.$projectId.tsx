import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { getListProjectsQueryOptions } from "@/api/generated/endpoints/projects/projects";
import { getListWorkspacesQueryOptions } from "@/api/generated/endpoints/workspaces/workspaces";
import { ApiError } from "@/api/http";
import { isUuid } from "@roadmapper/domain/ids";

// Workspace・Projectの存在確認とパンくず用のデータ取得。ロードマップの階層の親になる。
export const Route = createFileRoute("/w/$workspaceId/p/$projectId")({
  loader: async ({ context: { queryClient }, params }) => {
    if (!isUuid(params.workspaceId) || !isUuid(params.projectId)) throw notFound();
    try {
      const [workspaces, projects] = await Promise.all([
        queryClient.ensureQueryData(getListWorkspacesQueryOptions()),
        queryClient.ensureQueryData(getListProjectsQueryOptions(params.workspaceId)),
      ]);
      const workspace =
        workspaces.status === 200
          ? workspaces.data.find((w) => w.id === params.workspaceId)
          : undefined;
      const project =
        projects.status === 200 ? projects.data.find((p) => p.id === params.projectId) : undefined;
      if (!workspace || !project) throw notFound();
      return { workspace, project };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  },
  component: Outlet,
});
