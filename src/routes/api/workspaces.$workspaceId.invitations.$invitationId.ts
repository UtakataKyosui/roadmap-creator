import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle } from "@/server/http";
import { revokeInvitation } from "@/server/invitations";

export const Route = createFileRoute("/api/workspaces/$workspaceId/invitations/$invitationId")({
  server: {
    handlers: {
      DELETE: ({ params }) =>
        handle(
          (actorId) => revokeInvitation(db, actorId, params.workspaceId, params.invitationId),
          204,
        ),
    },
  },
});
