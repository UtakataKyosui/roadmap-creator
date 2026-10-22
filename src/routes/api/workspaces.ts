import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle, readJson } from "@/server/http";
import { createWorkspace, listWorkspaces } from "@/server/workspaces";

export const Route = createFileRoute("/api/workspaces")({
  server: {
    handlers: {
      GET: () => handle((actorId) => listWorkspaces(db, actorId)),
      POST: ({ request }) =>
        handle(async (actorId) => createWorkspace(db, actorId, await readJson(request)), 201),
    },
  },
});
