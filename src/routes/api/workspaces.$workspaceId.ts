import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle, readJson } from "@/server/http";
import { deleteWorkspace, updateWorkspace } from "@/server/workspaces";

export const Route = createFileRoute("/api/workspaces/$workspaceId")({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        handle(async (actorId) =>
          updateWorkspace(db, actorId, params.workspaceId, await readJson(request)),
        ),
      DELETE: ({ params }) =>
        handle((actorId) => deleteWorkspace(db, actorId, params.workspaceId), 204),
    },
  },
});
