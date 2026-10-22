import { queryOptions } from "@tanstack/react-query";
import { getListTasksQueryKey, listTasks } from "./generated/endpoints/tasks/tasks";
import type { Task } from "@roadmapper/api-contract/models";
import { ListTasksResponse } from "@roadmapper/api-contract/zod/tasks/tasks.zod";
import { parseResponse } from "./validation";

// 全ページを取得し、件数と移動先の隣接関係をページ境界でも正しく扱う。
export const roadmapTasksOptions = (workspaceId: string, roadmapId: string) =>
  queryOptions({
    queryKey: [...getListTasksQueryKey(workspaceId, roadmapId), "all"],
    queryFn: async ({ signal }) => {
      const tasks = new Map<string, Task>();
      const cursors = new Set<string>();
      let cursor: string | undefined;
      do {
        const response = await listTasks(
          workspaceId,
          roadmapId,
          { limit: 200, cursor },
          { signal },
        );
        if (response.status !== 200) throw new Error("Unexpected task response");
        const page = parseResponse(ListTasksResponse, response.data);
        page.items.forEach((task) => tasks.set(task.id, task));
        cursor = page.nextCursor ?? undefined;
        if (cursor && cursors.has(cursor)) throw new Error("Repeated task cursor");
        if (cursor) cursors.add(cursor);
      } while (cursor);
      return [...tasks.values()];
    },
  });
