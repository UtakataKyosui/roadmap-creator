import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle } from "@/server/http";
import { acceptInvitation } from "@/server/invitations";

export const Route = createFileRoute("/api/invitations/$token/accept")({
  server: {
    handlers: {
      POST: ({ params }) => handle((actorId) => acceptInvitation(db, actorId, params.token)),
    },
  },
});
