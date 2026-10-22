import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle } from "@/server/http";
import { resendInvitation } from "@/server/invitations";

export const Route = createFileRoute(
  "/api/workspaces/$workspaceId/invitations/$invitationId/resend",
)({
  server: {
    handlers: {
      POST: ({ params }) =>
        handle((actorId) => resendInvitation(db, actorId, params.workspaceId, params.invitationId)),
    },
  },
});
