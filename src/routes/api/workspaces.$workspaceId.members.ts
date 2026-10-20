import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle } from "@/server/http";
import { listWorkspaceMembers } from "@/server/workspaces";

export const Route = createFileRoute("/api/workspaces/$workspaceId/members")({
  server: {
    handlers: {
      GET: ({ params }) =>
        handle((actorId) => listWorkspaceMembers(db, actorId, params.workspaceId)),
    },
  },
});
