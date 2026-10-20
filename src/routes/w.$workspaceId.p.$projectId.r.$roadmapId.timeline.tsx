import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/state/StateViews";

export const Route = createFileRoute("/w/$workspaceId/p/$projectId/r/$roadmapId/timeline")({
  component: () => (
    <main>
      <EmptyState title="タイムライン" description="#8 で実装します。" />
    </main>
  ),
});
