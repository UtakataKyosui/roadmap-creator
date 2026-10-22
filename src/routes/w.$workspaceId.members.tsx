import { createFileRoute, notFound } from "@tanstack/react-router";
import { getListWorkspacesQueryOptions } from "@/api/generated/endpoints/workspaces/workspaces";
import { getListProjectsQueryOptions } from "@/api/generated/endpoints/projects/projects";
import { MembersPage } from "@/components/members/MembersPage";
import { parseMembersSearch, pickReturnProject } from "@roadmapper/domain/members-search";
import { isUuid } from "@roadmapper/domain/ids";

// ワークスペースのメンバー一覧と、メンバーの招待・招待の管理。
export const Route = createFileRoute("/w/$workspaceId/members")({
  validateSearch: parseMembersSearch,
  loaderDeps: ({ search }) => ({ projectId: search.projectId }),
  loader: async ({ context: { queryClient }, params, deps }) => {
    if (!isUuid(params.workspaceId)) throw notFound();
    const workspaces = await queryClient.ensureQueryData(getListWorkspacesQueryOptions());
    const workspace =
      workspaces.status === 200
        ? workspaces.data.find((w) => w.id === params.workspaceId)
        : undefined;
    if (!workspace) throw notFound();
    // 「ロードマップ」の戻り先。取得に失敗してもメンバー画面は表示する。
    const projects = await queryClient
      .ensureQueryData(getListProjectsQueryOptions(workspace.id))
      .catch(() => undefined);
    const project =
      projects?.status === 200 ? pickReturnProject(projects.data, deps.projectId) : undefined;
    return { workspace, project };
  },
  head: () => ({ meta: [{ title: "メンバー | Roadmap Studio" }] }),
  component: MembersRoute,
});

function MembersRoute() {
  const { workspace, project } = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return <MembersPage workspace={workspace} project={project} currentUserId={user!.id} />;
}
