import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle } from "@/server/http";
import { getInvitationPreview } from "@/server/invitations";

export const Route = createFileRoute("/api/invitations/$token")({
  server: {
    handlers: {
      GET: ({ params }) => handle((actorId) => getInvitationPreview(db, actorId, params.token)),
    },
  },
});
