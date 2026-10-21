import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle } from "@/server/http";
import { listMyTasks } from "@/server/my-tasks";

export const Route = createFileRoute("/api/me/tasks")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle((actorId) => listMyTasks(db, actorId, new URL(request.url).searchParams)),
    },
  },
});
