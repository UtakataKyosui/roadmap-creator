import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/state/StateViews";

export const Route = createFileRoute("/w/$workspaceId/p/$projectId/r/$roadmapId/board")({
  component: () => (
    <main>
      <EmptyState title="ボード" description="#6 で実装します。" />
    </main>
  ),
});
