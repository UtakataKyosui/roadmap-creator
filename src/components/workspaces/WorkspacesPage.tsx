import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouteContext, useRouter } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { apiErrorMessage } from "@/api/error-message";
import { useListProjects, useUpdateProject } from "@/api/generated/endpoints/projects/projects";
import {
  getListWorkspacesQueryKey,
  useCreateWorkspace,
  useListWorkspaces,
  useListWorkspaceMembers,
  useDeleteWorkspace,
  useUpdateWorkspace,
  type listWorkspacesResponseSuccess,
} from "@/api/generated/endpoints/workspaces/workspaces";
import type { Workspace, Project } from "@roadmapper/api-contract/models";
import { AppHeader, PageHeader } from "@/components/layout/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/state/StateViews";
import { Button } from "@roadmapper/ui/components/ui/button";
import { cacheProjectName, cacheWorkspaceName, removeWorkspaceCache } from "@/api/cache";
import { NameEditor } from "./NameEditor";

export function WorkspacesPage() {
  const queryClient = useQueryClient();
  const workspaces = useListWorkspaces();
  const create = useCreateWorkspace();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const hintId = useId();

  const submit = async () => {
    if (create.isPending) return;
    const trimmed = name.trim();
    setCreatedName(null);
    if (!trimmed || name.length > 100) {
      setError(
        !trimmed ? "ワークスペース名を入力してください。" : "100文字以内で入力してください。",
      );
      return;
    }
    setError(null);
    try {
      const result = await create.mutateAsync({ data: { name: trimmed } });
      setName("");
      setCreatedName(result.data.name);
      // 保存後の一覧取得が失敗しても、作成済みのワークスペースへの導線を残す。
      await queryClient.cancelQueries({ queryKey: getListWorkspacesQueryKey() });
      queryClient.setQueryData<listWorkspacesResponseSuccess>(
        getListWorkspacesQueryKey(),
        (current) => ({
          ...result,
          status: 200,
          data: [
            ...(current?.data.filter((workspace) => workspace.id !== result.data.id) ?? []),
            result.data,
          ].sort((a, b) => a.name.localeCompare(b.name)),
        }),
      );
      void queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() });
    } catch (cause) {
      setError(apiErrorMessage(cause));
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader trail={["ワークスペース"]} />
      <main className="mx-auto w-full max-w-4xl flex-1">
        <PageHeader
          title="ワークスペース"
          description="作業するワークスペースを選ぶか、新しく作成します。"
        />
        <div className="space-y-6 px-7 pb-8">
          <section
            className="rounded-sm border bg-surface p-5"
            aria-labelledby="workspace-create-title"
          >
            <h2 id="workspace-create-title" className="mb-4 text-sm font-bold">
              ワークスペースを作成
            </h2>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <label htmlFor={inputId} className="mb-2 block text-xs font-semibold">
                ワークスペース名
              </label>
              <div className="flex flex-wrap items-start gap-3">
                <input
                  id={inputId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={create.isPending}
                  maxLength={100}
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                  placeholder="例：学習チーム"
                  className="h-9 min-w-0 flex-1 basis-60 rounded-sm border border-border-strong bg-surface px-3 text-[13px] focus:border-indigo focus:outline-none aria-invalid:border-destructive"
                />
                <Button type="submit" disabled={create.isPending}>
                  <Plus aria-hidden />
                  {create.isPending ? "作成中…" : "作成する"}
                </Button>
              </div>
              <p id={hintId} className="mt-2 text-xs text-subtle-foreground">
                100文字以内。初期プロジェクト「マイプロジェクト」も作成されます。
              </p>
              {error && (
                <p id={errorId} role="alert" className="mt-2 text-xs text-danger">
                  {error}
                </p>
              )}
              {createdName && (
                <p role="status" className="mt-3 text-sm text-indigo">
                  「{createdName}」を作成しました。下のプロジェクトからロードマップを作成できます。
                </p>
              )}
            </form>
          </section>
          <section aria-labelledby="workspace-list-title">
            <h2 id="workspace-list-title" className="mb-3 text-sm font-bold">
              参加しているワークスペース
            </h2>
            {workspaces.isPending ? (
              <LoadingState />
            ) : workspaces.isError && !workspaces.data ? (
              <ErrorState error={workspaces.error} onRetry={() => void workspaces.refetch()} />
            ) : workspaces.data?.data.length ? (
              <div className="space-y-3">
                {workspaces.data.data.map((workspace) => (
                  <WorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    onDeleted={() => setCreatedName(null)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="ワークスペースがありません"
                description="上のフォームから、最初のワークスペースを作成してください。"
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function WorkspaceCard({ workspace, onDeleted }: { workspace: Workspace; onDeleted: () => void }) {
  const projects = useListProjects(workspace.id);
  const { user } = useRouteContext({ from: "__root__" });
  const members = useListWorkspaceMembers(workspace.id);
  const owner = members.data?.data.some(
    (member) => member.user.id === user?.id && member.role === "owner",
  );
  const manager = members.data?.data.some(
    (member) => member.user.id === user?.id && member.role !== "member",
  );
  const [editing, setEditing] = useState(false);
  const update = useUpdateWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const remove = useDeleteWorkspace();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const confirmationId = useId();
  const activeProjects = projects.data?.data.filter((project) => !project.archivedAt) ?? [];
  return (
    <article className="rounded-sm border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <NameEditor
            initial={workspace}
            label="ワークスペース名"
            onCancel={() => setEditing(false)}
            onRefresh={() =>
              queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() })
            }
            onSave={async (data) => {
              const result = await update.mutateAsync({ workspaceId: workspace.id, data });
              await cacheWorkspaceName(queryClient, result.data);
              setEditing(false);
              void router.invalidate();
            }}
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 break-words text-sm font-bold">{workspace.name}</h3>
            {manager && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`ワークスペース「${workspace.name}」の名称を編集`}
                disabled={confirming}
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden />
              </Button>
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Link
            to="/w/$workspaceId/members"
            params={{ workspaceId: workspace.id }}
            className="text-xs text-indigo hover:underline"
          >
            メンバー
          </Link>
          {owner && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              onClick={() => {
                setEditing(false);
                setConfirming(true);
                remove.reset();
              }}
              aria-label={`「${workspace.name}」を削除`}
            >
              <Trash2 aria-hidden />
              削除
            </Button>
          )}
        </div>
      </div>
      {projects.isPending ? (
        <LoadingState label="プロジェクトを読み込み中…" />
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
      ) : activeProjects.length ? (
        <ul className="mt-3 flex flex-wrap gap-3">
          {activeProjects.map((project) => (
            <ProjectName key={project.id} project={project} canEdit={!!manager && !confirming} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-subtle-foreground">
          アクティブなプロジェクトがありません。
        </p>
      )}
      {confirming && (
        <section
          aria-label="ワークスペースの削除確認"
          className="mt-4 space-y-3 rounded-sm border border-danger bg-danger-tint p-4"
        >
          <h4 className="text-sm font-bold">「{workspace.name}」を削除しますか？</h4>
          <p className="text-xs leading-6">
            配下のプロジェクト、ロードマップ、タスク、コメント、招待もすべて削除されます。この操作は取り消せません。
          </p>
          <label htmlFor={confirmationId} className="block text-xs">
            確認のため、ワークスペース名を入力してください。
          </label>
          <input
            id={confirmationId}
            value={confirmation}
            disabled={remove.isPending}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="h-9 w-full rounded-sm border bg-surface px-3 text-sm"
          />
          {remove.error && (
            <p role="alert" className="text-xs text-danger">
              {apiErrorMessage(remove.error)}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={confirmation !== workspace.name || remove.isPending}
              onClick={() =>
                remove.mutate(
                  { workspaceId: workspace.id },
                  {
                    onSuccess: async () => {
                      await removeWorkspaceCache(queryClient, workspace.id);
                      onDeleted();
                    },
                  },
                )
              }
            >
              {remove.isPending ? "削除中…" : "完全に削除する"}
            </Button>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => {
                setConfirming(false);
                setConfirmation("");
              }}
            >
              キャンセル
            </Button>
          </div>
        </section>
      )}
    </article>
  );
}

function ProjectName({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateProject();
  const queryClient = useQueryClient();
  const router = useRouter();
  const projects = useListProjects(project.workspaceId);
  return (
    <li className={editing ? "w-full" : "flex items-center gap-2"}>
      {editing && canEdit ? (
        <NameEditor
          initial={project}
          label="プロジェクト名"
          onCancel={() => setEditing(false)}
          onRefresh={() => projects.refetch()}
          onSave={async (data) => {
            const result = await update.mutateAsync({
              workspaceId: project.workspaceId,
              projectId: project.id,
              data,
            });
            await cacheProjectName(queryClient, result.data);
            setEditing(false);
            void router.invalidate();
          }}
        />
      ) : (
        <>
          <Link
            to="/w/$workspaceId/p/$projectId"
            params={{ workspaceId: project.workspaceId, projectId: project.id }}
            className="text-sm text-indigo hover:underline"
          >
            {project.name}
          </Link>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`プロジェクト「${project.name}」の名称を編集`}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
            </Button>
          )}
        </>
      )}
    </li>
  );
}
