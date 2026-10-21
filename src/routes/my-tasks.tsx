import { createFileRoute } from "@tanstack/react-router";
import { getListMyTasksQueryOptions } from "@/api/generated/endpoints/my-tasks/my-tasks";
import { MyTasksPage } from "@/components/my-tasks/MyTasksPage";
import { todayCalendarDate } from "@/domain/calendar-date";
import { parseMyTasksSearch, toApiParams } from "@/domain/my-tasks";

// ログイン中の利用者が担当するタスクの一覧。条件とページ番号はURLで持つ。
export const Route = createFileRoute("/my-tasks")({
  validateSearch: parseMyTasksSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps }) => {
    const today = todayCalendarDate();
    // 取得に失敗しても画面側でエラー表示と再試行を出すため、ここでは例外にしない。
    await queryClient.prefetchQuery(getListMyTasksQueryOptions(toApiParams(deps.search, today)));
    return { today };
  },
  head: () => ({ meta: [{ title: "マイタスク | Roadmap Studio" }] }),
  component: MyTasksRoute,
});

function MyTasksRoute() {
  const search = Route.useSearch();
  const { today } = Route.useLoaderData();
  return <MyTasksPage search={search} initialToday={today} />;
}
