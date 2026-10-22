import { createFileRoute } from "@tanstack/react-router";
import { database as db } from "@/server/database";
import { handle, readJson } from "@/server/http";
import { createProject, listProjects } from "@/server/workspaces";

export const Route = createFileRoute("/api/workspaces/$workspaceId/projects")({
  server: {
    handlers: {
      GET: ({ params }) => handle((actorId) => listProjects(db, actorId, params.workspaceId)),
      POST: ({ params, request }) =>
        handle(
          async (actorId) =>
            createProject(db, actorId, params.workspaceId, await readJson(request)),
          201,
        ),
    },
  },
});
