import { createFileRoute, notFound } from "@tanstack/react-router";
import { getListWorkspacesQueryOptions } from "@/api/generated/endpoints/workspaces/workspaces";
import { MembersPage } from "@/components/members/MembersPage";
import { isUuid } from "@/server/ids";

// ワークスペースのメンバー一覧と、メンバーの招待・招待の管理。
export const Route = createFileRoute("/w/$workspaceId/members")({
  loader: async ({ context: { queryClient }, params }) => {
    if (!isUuid(params.workspaceId)) throw notFound();
    const workspaces = await queryClient.ensureQueryData(getListWorkspacesQueryOptions());
    const workspace =
      workspaces.status === 200
        ? workspaces.data.find((w) => w.id === params.workspaceId)
        : undefined;
    if (!workspace) throw notFound();
    return { workspace };
  },
  head: () => ({ meta: [{ title: "メンバー | Roadmap Studio" }] }),
  component: MembersRoute,
});

function MembersRoute() {
  const { workspace } = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return <MembersPage workspace={workspace} currentUserId={user!.id} />;
}
