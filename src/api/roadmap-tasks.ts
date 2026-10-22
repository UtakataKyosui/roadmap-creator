import { queryOptions } from "@tanstack/react-query";
import { Effect } from "effect";
import { runPromise } from "@/lib/effect";
import { getListTasksQueryKey, getListTasksUrl } from "./generated/endpoints/tasks/tasks";
import type { Task } from "./generated/models";
import { ListTasksResponse } from "./generated/zod/tasks/tasks.zod";
import { customFetchEffect } from "./http";
import { parseResponseEffect, ResponseValidationError } from "./validation";

export const roadmapTasksEffect = (workspaceId: string, roadmapId: string, signal?: AbortSignal) =>
  Effect.gen(function* () {
    const tasks = new Map<string, Task>();
    const cursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const response = yield* customFetchEffect<{ status: number; data: unknown }>(
        getListTasksUrl(workspaceId, roadmapId, { limit: 200, cursor }),
        { method: "GET", signal },
      );
      if (response.status !== 200) {
        return yield* Effect.fail(
          new ResponseValidationError([{ path: [], message: "Unexpected task response" }]),
        );
      }
      const page = yield* parseResponseEffect(ListTasksResponse, response.data);
      page.items.forEach((task) => tasks.set(task.id, task));
      cursor = page.nextCursor ?? undefined;
      if (cursor && cursors.has(cursor)) {
        return yield* Effect.fail(
          new ResponseValidationError([{ path: ["nextCursor"], message: "Repeated task cursor" }]),
        );
      }
      if (cursor) cursors.add(cursor);
    } while (cursor);
    return [...tasks.values()];
  });

// 全ページを取得し、件数と移動先の隣接関係をページ境界でも正しく扱う。
export const roadmapTasksOptions = (workspaceId: string, roadmapId: string) =>
  queryOptions({
    queryKey: [...getListTasksQueryKey(workspaceId, roadmapId), "all"],
    queryFn: ({ signal }) => runPromise(roadmapTasksEffect(workspaceId, roadmapId, signal)),
  });
