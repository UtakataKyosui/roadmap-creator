import { createFileRoute } from "@tanstack/react-router";
import { WorkspacesPage } from "@/components/workspaces/WorkspacesPage";

export const Route = createFileRoute("/workspaces")({
  head: () => ({ meta: [{ title: "ワークスペース | Roadmap Studio" }] }),
  component: WorkspacesPage,
});
