import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { roadmapTasksOptions } from "@/api/roadmap-tasks";
import { TaskMap } from "@/components/task/TaskMap";
import { todayCalendarDate } from "@/domain/calendar-date";

const roadmapRoute = getRouteApi("/w/$workspaceId/p/$projectId/r/$roadmapId");

export const Route = createFileRoute("/w/$workspaceId/p/$projectId/r/$roadmapId/map")({
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(roadmapTasksOptions(params.workspaceId, params.roadmapId));
    return { today: todayCalendarDate() };
  },
  component: MapPage,
});

function MapPage() {
  const scope = Route.useParams();
  const { today } = Route.useLoaderData();
  const { roadmap } = roadmapRoute.useLoaderData();
  return <TaskMap key={scope.roadmapId} scope={scope} initialToday={today} name={roadmap.name} />;
}
