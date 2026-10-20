import type { QueryClient } from "@tanstack/react-query";
import { getListRoadmapsQueryKey } from "./generated/endpoints/roadmaps/roadmaps";
import { getGetTaskQueryKey, getListTasksQueryKey } from "./generated/endpoints/tasks/tasks";

// QueryKeyは生成された getXxxQueryKey を使う。URLにworkspaceIdとroadmapIdが入るため、
// 引数を省いたキーは同じロードマップの全フィルタ・全ページに前方一致する。

export const invalidateRoadmapList = (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
) =>
  queryClient.invalidateQueries({
    queryKey: getListRoadmapsQueryKey(workspaceId, projectId),
  });

// タスクの作成・更新・移動・削除の後に呼ぶ。一覧（ボード・タイムライン）と詳細を更新する。
export const invalidateTasks = (
  queryClient: QueryClient,
  workspaceId: string,
  roadmapId: string,
  taskId?: string,
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(workspaceId, roadmapId) }),
    taskId
      ? queryClient.invalidateQueries({
          queryKey: getGetTaskQueryKey(workspaceId, roadmapId, taskId),
        })
      : undefined,
  ]);

// ログアウト時に呼ぶ。別ユーザーのキャッシュを残さない。
export const clearUserCache = (queryClient: QueryClient) => queryClient.clear();
