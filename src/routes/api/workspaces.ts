import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle } from "@/server/http";
import { listWorkspaces } from "@/server/workspaces";

export const Route = createFileRoute("/api/workspaces")({
  server: {
    handlers: {
      GET: () => handle((actorId) => listWorkspaces(db, actorId)),
    },
  },
});
