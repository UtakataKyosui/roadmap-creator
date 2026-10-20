import { createFileRoute } from "@tanstack/react-router";
import { roadmapTasksOptions } from "@/api/roadmap-tasks";
import { TaskBoard } from "@/components/task/TaskBoard";
import { todayCalendarDate } from "@/domain/calendar-date";

export const Route = createFileRoute("/w/$workspaceId/p/$projectId/r/$roadmapId/board")({
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(roadmapTasksOptions(params.workspaceId, params.roadmapId));
    return { today: todayCalendarDate() };
  },
  component: BoardPage,
});

function BoardPage() {
  const scope = Route.useParams();
  const { today } = Route.useLoaderData();
  return <TaskBoard key={scope.roadmapId} scope={scope} initialToday={today} />;
}
