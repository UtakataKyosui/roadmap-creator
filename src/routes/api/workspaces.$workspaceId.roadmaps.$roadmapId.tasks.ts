import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle, readJson } from "@/server/http";
import { createTask, listTasks } from "@/server/tasks";

export const Route = createFileRoute("/api/workspaces/$workspaceId/roadmaps/$roadmapId/tasks")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handle((actorId) =>
          listTasks(
            db,
            actorId,
            params.workspaceId,
            params.roadmapId,
            new URL(request.url).searchParams,
          ),
        ),
      POST: ({ request, params }) =>
        handle(
          async (actorId) =>
            createTask(db, actorId, params.workspaceId, params.roadmapId, await readJson(request)),
          201,
        ),
    },
  },
});
