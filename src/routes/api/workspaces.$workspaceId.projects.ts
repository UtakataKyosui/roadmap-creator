import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle } from "@/server/http";
import { listProjects } from "@/server/workspaces";

export const Route = createFileRoute("/api/workspaces/$workspaceId/projects")({
  server: {
    handlers: {
      GET: ({ params }) => handle((actorId) => listProjects(db, actorId, params.workspaceId)),
    },
  },
});
