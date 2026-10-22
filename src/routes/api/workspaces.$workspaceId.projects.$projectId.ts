import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle, readJson } from "@/server/http";
import { updateProject } from "@/server/workspaces";

export const Route = createFileRoute("/api/workspaces/$workspaceId/projects/$projectId")({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        handle(async (actorId) =>
          updateProject(db, actorId, params.workspaceId, params.projectId, await readJson(request)),
        ),
    },
  },
});
