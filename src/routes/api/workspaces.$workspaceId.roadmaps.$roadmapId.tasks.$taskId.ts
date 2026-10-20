import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle, readJson } from "@/server/http";
import { getTask, updateTask } from "@/server/tasks";

export const Route = createFileRoute(
  "/api/workspaces/$workspaceId/roadmaps/$roadmapId/tasks/$taskId",
)({
  server: {
    handlers: {
      GET: ({ params }) =>
        handle((actorId) =>
          getTask(db, actorId, params.workspaceId, params.roadmapId, params.taskId),
        ),
      PATCH: ({ request, params }) =>
        handle(async (actorId) =>
          updateTask(
            db,
            actorId,
            params.workspaceId,
            params.roadmapId,
            params.taskId,
            await readJson(request),
          ),
        ),
    },
  },
});
