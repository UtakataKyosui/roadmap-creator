import { createFileRoute } from "@tanstack/react-router";
import { InvitationAcceptPage } from "@/components/members/InvitationAcceptPage";

// 招待URLの受諾画面。ログイン前に開いた場合は、ログイン後にこの画面へ戻る。
export const Route = createFileRoute("/invitations/$token")({
  head: () => ({ meta: [{ title: "招待 | Roadmap Studio" }] }),
  component: InvitationRoute,
});

function InvitationRoute() {
  const { token } = Route.useParams();
  const { user } = Route.useRouteContext();
  return <InvitationAcceptPage token={token} userEmail={user!.email} />;
}
