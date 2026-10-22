import { createFileRoute } from "@tanstack/react-router";
import { roadmapTasksOptions } from "@/api/roadmap-tasks";
import { TaskTimeline } from "@/components/task/TaskTimeline";
import { todayCalendarDate } from "@roadmapper/domain/calendar-date";

export const Route = createFileRoute("/w/$workspaceId/p/$projectId/r/$roadmapId/timeline")({
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(roadmapTasksOptions(params.workspaceId, params.roadmapId));
    return { today: todayCalendarDate() };
  },
  component: TimelinePage,
});

function TimelinePage() {
  const scope = Route.useParams();
  const { today } = Route.useLoaderData();
  return <TaskTimeline key={scope.roadmapId} scope={scope} initialToday={today} />;
}
