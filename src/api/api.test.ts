import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { ApiError } from "./http";
import type { Task } from "@roadmapper/api-contract/models";
import { createQueryClient } from "./query-client";
import {
  cacheProjectName,
  cacheWorkspaceName,
  invalidateRoadmaps,
  invalidateTasks,
  removeWorkspaceCache,
} from "./cache";
import { getListProjectsQueryKey } from "./generated/endpoints/projects/projects";
import {
  deleteWorkspace,
  getListWorkspacesQueryKey,
} from "./generated/endpoints/workspaces/workspaces";
import { getListMyTasksQueryKey } from "./generated/endpoints/my-tasks/my-tasks";
import {
  CreateTaskInput,
  ResponseValidationError,
  parseResponse,
  updateTaskInputFor,
} from "./validation";
import { MutationObserver } from "@tanstack/react-query";
import {
  getListTasksQueryOptions,
  getUpdateTaskMutationOptions,
  updateTask,
} from "./generated/endpoints/tasks/tasks";
import { ListTasksResponse } from "@roadmapper/api-contract/zod/tasks/tasks.zod";
import { roadmapTasksOptions } from "./roadmap-tasks";

const workspaceId = "0190a000-0000-7000-8000-000000000001";
const roadmapId = "0190a000-0000-7000-8000-000000000002";
const taskId = "0190a000-0000-7000-8000-000000000003";

const task: Task = {
  id: taskId,
  roadmapId,
  workspaceId,
  title: "基礎を学ぶ",
  description: null,
  status: "todo",
  priority: "medium",
  assigneeId: null,
  startDate: "2026-10-01",
  dueDate: "2026-10-31",
  labelIds: [],
  sortOrder: "a0",
  commentCount: 0,
  createdBy: "0190a000-0000-7000-8000-000000000004",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  version: 1,
};

const stubFetch = (status: number, body: unknown) => {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("画面用の全ページ取得", () => {
  test("cursorを継承して全ページを取得し、ページ間の重複IDを除く", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [task], nextCursor: "page-2" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [task, { ...task, id: "0190a000-0000-7000-8000-000000000005" }],
            nextCursor: null,
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();
    const result = await client.fetchQuery(roadmapTasksOptions(workspaceId, roadmapId));
    expect(result).toHaveLength(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=page-2");
    expect(String(fetchMock.mock.calls[1][0])).toContain(roadmapId);
    await invalidateTasks(client, workspaceId, roadmapId);
    expect(
      client.getQueryState(roadmapTasksOptions(workspaceId, roadmapId).queryKey)?.isInvalidated,
    ).toBe(true);
    client.clear();
  });
  test("タスクの更新後は、マイタスクのキャッシュも無効にする", async () => {
    const client = createQueryClient();
    const key = getListMyTasksQueryKey({ today: "2026-06-10", page: 2 });
    client.setQueryData(key, { items: [] });
    await invalidateTasks(client, workspaceId, roadmapId);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
  });
  test("ロードマップの名称変更後は全ページのマイタスクを無効にする", async () => {
    const client = createQueryClient();
    const keys = [1, 2].map((page) => getListMyTasksQueryKey({ today: "2026-06-10", page }));
    for (const key of keys) client.setQueryData(key, { items: [{ roadmapName: "変更前" }] });
    await invalidateRoadmaps(client, workspaceId, "project", roadmapId);
    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
  });
  test("同じcursorを返す壊れた応答で無限取得しない", async () => {
    const fetchMock = stubFetch(200, { items: [task], nextCursor: "repeated" });
    const client = createQueryClient();
    await expect(
      client.fetchQuery({ ...roadmapTasksOptions(workspaceId, roadmapId), retry: false }),
    ).rejects.toThrow("Repeated task cursor");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    client.clear();
  });
});

describe("Zodスキーマ", () => {
  test("正常な一覧応答を受け入れる", () => {
    const parsed = parseResponse(ListTasksResponse, { items: [task], nextCursor: null });
    expect(parsed.items).toHaveLength(1);
  });

  test("不正なstatusとIDを拒否する", () => {
    expect(() =>
      parseResponse(ListTasksResponse, {
        items: [{ ...task, status: "doing", id: "not-a-uuid" }],
        nextCursor: null,
      }),
    ).toThrow(ResponseValidationError);
  });

  test("開始日が期限日より後の入力を拒否する", () => {
    const result = CreateTaskInput.safeParse({
      title: "基礎を学ぶ",
      startDate: "2026-11-01",
      dueDate: "2026-10-31",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["dueDate"]);
  });

  test("部分更新は省略した側の日付を現在値で補って検証する", () => {
    const schema = updateTaskInputFor({ startDate: "2026-10-01", dueDate: "2026-10-31" });

    expect(schema.safeParse({ version: 1, startDate: "2026-11-01" }).success).toBe(false);
    expect(schema.safeParse({ version: 1, startDate: "2026-10-15" }).success).toBe(true);
    expect(schema.safeParse({ version: 1, dueDate: null }).success).toBe(true);
  });

  test("片方だけの日付は受け入れる", () => {
    expect(CreateTaskInput.safeParse({ title: "基礎を学ぶ", dueDate: "2026-10-31" }).success).toBe(
      true,
    );
  });
});

describe("生成されたquery/mutation", () => {
  test("改名後はヘッダーとパンくずが読む一覧キャッシュを更新し、マイタスクを再取得対象にする", async () => {
    const client = createQueryClient();
    const workspace = {
      id: workspaceId,
      name: "元の名前",
      version: 1,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
    const project = { ...workspace, id: roadmapId, workspaceId };
    const workspaceKey = getListWorkspacesQueryKey();
    const projectKey = getListProjectsQueryKey(workspaceId);
    client.setQueryData(workspaceKey, { status: 200, headers: new Headers(), data: [workspace] });
    client.setQueryData(projectKey, { status: 200, headers: new Headers(), data: [project] });
    client.setQueryData(getListMyTasksQueryKey(), { data: [] });
    await cacheWorkspaceName(client, { ...workspace, name: "チームの新名称", version: 2 });
    await cacheProjectName(client, { ...project, name: "プロジェクトの新名称", version: 2 });
    expect(client.getQueryData(workspaceKey)).toMatchObject({
      data: [{ id: workspaceId, name: "チームの新名称", version: 2 }],
    });
    expect(client.getQueryData(projectKey)).toMatchObject({
      data: [{ id: roadmapId, name: "プロジェクトの新名称", version: 2 }],
    });
    expect(client.getQueryState(getListMyTasksQueryKey())?.isInvalidated).toBe(true);
    client.clear();
  });

  test("WorkspaceのDELETEは204の本文なし応答を扱える", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await deleteWorkspace(workspaceId);
    expect(response.status).toBe(204);
    expect(response.data).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/workspaces/${workspaceId}`),
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  test("Workspace削除後は対象データとマイタスクのキャッシュを捨て、別Workspaceを保持する", async () => {
    const client = createQueryClient();
    const otherId = "0190a000-0000-7000-8000-000000000099";
    const listKey = getListWorkspacesQueryKey();
    const tasksKey = getListTasksQueryOptions(workspaceId, roadmapId).queryKey;
    const otherKey = getListTasksQueryOptions(otherId, roadmapId).queryKey;
    client.setQueryData(listKey, { status: 200, data: [{ id: workspaceId }, { id: otherId }] });
    client.setQueryData(tasksKey, {
      status: 200,
      headers: new Headers(),
      data: { items: [task], nextCursor: null },
    });
    client.setQueryData(otherKey, {
      status: 200,
      headers: new Headers(),
      data: { items: [], nextCursor: null },
    });
    client.setQueryData(getListMyTasksQueryKey(), { data: [task] });
    await removeWorkspaceCache(client, workspaceId);
    expect(client.getQueryData(listKey)).toMatchObject({ data: [{ id: otherId }] });
    expect(client.getQueryData(tasksKey)).toBeUndefined();
    expect(client.getQueryData(getListMyTasksQueryKey())).toBeUndefined();
    expect(client.getQueryData(otherKey)).toMatchObject({ data: { items: [], nextCursor: null } });
    client.clear();
  });

  test("queryがAPIを呼び、QueryKeyにworkspaceとroadmapが入る", async () => {
    const fetchMock = stubFetch(200, { items: [task], nextCursor: null });
    const queryClient = createQueryClient();
    const options = getListTasksQueryOptions(workspaceId, roadmapId, { status: ["todo"] });

    const res = await queryClient.fetchQuery(options);

    expect(res.data.items[0]?.title).toBe("基礎を学ぶ");
    expect(options.queryKey[0]).toContain(workspaceId);
    expect(options.queryKey[0]).toContain(roadmapId);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("status=todo");
  });

  test("更新競合の409はApiErrorとして扱える", async () => {
    stubFetch(409, { code: "version_conflict", message: "stale" });

    const error = await updateTask(workspaceId, roadmapId, taskId, {
      version: 1,
      status: "done",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isVersionConflict).toBe(true);
  });

  test("mutationがAPIを呼び、成功後にタスク一覧を無効化できる", async () => {
    stubFetch(200, { items: [task], nextCursor: null });
    const queryClient = createQueryClient();
    const listOptions = getListTasksQueryOptions(workspaceId, roadmapId);
    await queryClient.fetchQuery(listOptions);
    const fetchMock = stubFetch(200, { ...task, status: "done", version: 2 });

    const observer = new MutationObserver(
      queryClient,
      getUpdateTaskMutationOptions({
        mutation: { onSuccess: () => invalidateTasks(queryClient, workspaceId, roadmapId, taskId) },
      }),
    );
    const res = await observer.mutate({
      workspaceId,
      roadmapId,
      taskId,
      data: { version: 1, status: "done" },
    });

    expect(res.data.status).toBe("done");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(queryClient.getQueryState(listOptions.queryKey)?.isInvalidated).toBe(true);
  });

  test("更新後の無効化でタスク一覧が再取得対象になる", async () => {
    stubFetch(200, { items: [task], nextCursor: null });
    const queryClient = createQueryClient();
    const options = getListTasksQueryOptions(workspaceId, roadmapId, { status: ["todo"] });
    await queryClient.fetchQuery(options);

    await invalidateTasks(queryClient, workspaceId, roadmapId);

    expect(queryClient.getQueryState(options.queryKey)?.isInvalidated).toBe(true);
  });
});

describe("再試行方針", () => {
  const retry = createQueryClient().getDefaultOptions().queries?.retry as (
    count: number,
    error: unknown,
  ) => boolean;
  const apiError = (status: number) => new ApiError(status, { code: "internal", message: "" });

  test("4xxは再試行しない", () => {
    expect(retry(0, apiError(404))).toBe(false);
  });

  test("5xxとネットワーク失敗は上限まで再試行する", () => {
    expect(retry(0, apiError(500))).toBe(true);
    expect(retry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(retry(2, apiError(500))).toBe(false);
  });

  test("検証エラーと不正なJSONは再試行しない", () => {
    expect(retry(0, new ResponseValidationError([]))).toBe(false);
    expect(retry(0, new SyntaxError("Unexpected token"))).toBe(false);
  });
});
