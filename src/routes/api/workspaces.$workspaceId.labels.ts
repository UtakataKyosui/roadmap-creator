import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle } from "@/server/http";
import { listLabels } from "@/server/workspaces";

export const Route = createFileRoute("/api/workspaces/$workspaceId/labels")({
  server: {
    handlers: {
      GET: ({ params }) => handle((actorId) => listLabels(db, actorId, params.workspaceId)),
    },
  },
});
