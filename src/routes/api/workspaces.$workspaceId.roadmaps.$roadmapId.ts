import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle, readJson } from "@/server/http";
import { getRoadmap, updateRoadmap } from "@/server/roadmaps";

export const Route = createFileRoute("/api/workspaces/$workspaceId/roadmaps/$roadmapId")({
  server: {
    handlers: {
      GET: ({ params }) =>
        handle((actorId) => getRoadmap(db, actorId, params.workspaceId, params.roadmapId)),
      PATCH: ({ request, params }) =>
        handle(async (actorId) =>
          updateRoadmap(db, actorId, params.workspaceId, params.roadmapId, await readJson(request)),
        ),
    },
  },
});
