import type { QueryClient } from "@tanstack/react-query";
import type { Workspace, Project } from "./generated/models";
import {
  getListProjectsQueryKey,
  type listProjectsResponseSuccess,
} from "./generated/endpoints/projects/projects";
import {
  getGetRoadmapQueryKey,
  getListRoadmapsQueryKey,
} from "./generated/endpoints/roadmaps/roadmaps";
import { getListMyTasksQueryKey } from "./generated/endpoints/my-tasks/my-tasks";
import { getGetTaskQueryKey, getListTasksQueryKey } from "./generated/endpoints/tasks/tasks";
import {
  getListWorkspacesQueryKey,
  type listWorkspacesResponseSuccess,
} from "./generated/endpoints/workspaces/workspaces";

export const cacheWorkspaceName = async (queryClient: QueryClient, workspace: Workspace) => {
  const key = getListWorkspacesQueryKey();
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<listWorkspacesResponseSuccess>(key, (current) =>
    current
      ? {
          ...current,
          data: current.data
            .map((item) => (item.id === workspace.id ? workspace : item))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }
      : current,
  );
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: key }),
    queryClient.invalidateQueries({ queryKey: getListMyTasksQueryKey() }),
  ]);
};

export const cacheProjectName = async (queryClient: QueryClient, project: Project) => {
  const key = getListProjectsQueryKey(project.workspaceId);
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<listProjectsResponseSuccess>(key, (current) =>
    current
      ? { ...current, data: current.data.map((item) => (item.id === project.id ? project : item)) }
      : current,
  );
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: key }),
    queryClient.invalidateQueries({ queryKey: getListMyTasksQueryKey() }),
  ]);
};

export const removeWorkspaceCache = async (queryClient: QueryClient, workspaceId: string) => {
  const scoped = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      typeof query.queryKey[0] === "string" &&
      query.queryKey[0].startsWith(`/api/workspaces/${workspaceId}`),
  };
  await Promise.all([
    queryClient.cancelQueries(scoped),
    queryClient.cancelQueries({ queryKey: getListWorkspacesQueryKey() }),
    queryClient.cancelQueries({ queryKey: getListMyTasksQueryKey() }),
  ]);
  queryClient.removeQueries(scoped);
  queryClient.setQueryData<listWorkspacesResponseSuccess>(getListWorkspacesQueryKey(), (current) =>
    current
      ? { ...current, data: current.data.filter((workspace) => workspace.id !== workspaceId) }
      : current,
  );
  queryClient.removeQueries({ queryKey: getListMyTasksQueryKey(), type: "inactive" });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListMyTasksQueryKey() }),
  ]);
};

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

// ロードマップの作成・名称変更の後に呼ぶ。マイタスクのロードマップ名も更新する。
export const invalidateRoadmaps = (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  roadmapId?: string,
) =>
  Promise.all([
    invalidateRoadmapList(queryClient, workspaceId, projectId),
    queryClient.invalidateQueries({ queryKey: getListMyTasksQueryKey() }),
    roadmapId
      ? queryClient.invalidateQueries({ queryKey: getGetRoadmapQueryKey(workspaceId, roadmapId) })
      : undefined,
  ]);

// タスクの作成・更新・移動・削除の後に呼ぶ。一覧（ボード・タイムライン）と詳細に加え、
// 担当者・ステータスの変更がマイタスクにも反映されるよう、マイタスクを更新する。
export const invalidateTasks = (
  queryClient: QueryClient,
  workspaceId: string,
  roadmapId: string,
  taskId?: string,
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(workspaceId, roadmapId) }),
    queryClient.invalidateQueries({ queryKey: getListMyTasksQueryKey() }),
    taskId
      ? queryClient.invalidateQueries({
          queryKey: getGetTaskQueryKey(workspaceId, roadmapId, taskId),
        })
      : undefined,
  ]);

// ログアウト時に呼ぶ。別ユーザーのキャッシュを残さない。
export const clearUserCache = (queryClient: QueryClient) => queryClient.clear();
