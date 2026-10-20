import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle, readJson } from "@/server/http";
import { createRoadmap, listRoadmaps } from "@/server/roadmaps";

export const Route = createFileRoute("/api/workspaces/$workspaceId/projects/$projectId/roadmaps")({
  server: {
    handlers: {
      GET: ({ params }) =>
        handle((actorId) => listRoadmaps(db, actorId, params.workspaceId, params.projectId)),
      POST: ({ request, params }) =>
        handle(
          async (actorId) =>
            createRoadmap(
              db,
              actorId,
              params.workspaceId,
              params.projectId,
              await readJson(request),
            ),
          201,
        ),
    },
  },
});
