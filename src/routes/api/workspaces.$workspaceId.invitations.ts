import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle, readJson } from "@/server/http";
import { createInvitation, listInvitations } from "@/server/invitations";

export const Route = createFileRoute("/api/workspaces/$workspaceId/invitations")({
  server: {
    handlers: {
      GET: ({ params }) => handle((actorId) => listInvitations(db, actorId, params.workspaceId)),
      POST: ({ request, params }) =>
        handle(
          async (actorId) =>
            createInvitation(db, actorId, params.workspaceId, await readJson(request)),
          201,
        ),
    },
  },
});
