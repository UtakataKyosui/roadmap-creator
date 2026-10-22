import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { apiErrorMessage } from "@/api/error-message";
import { useListProjects } from "@/api/generated/endpoints/projects/projects";
import {
  getListWorkspacesQueryKey,
  useCreateWorkspace,
  useListWorkspaces,
  type listWorkspacesResponseSuccess,
} from "@/api/generated/endpoints/workspaces/workspaces";
import type { Workspace } from "@/api/generated/models";
import { AppHeader, PageHeader } from "@/components/layout/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";

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
                  <WorkspaceCard key={workspace.id} workspace={workspace} />
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

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const projects = useListProjects(workspace.id);
  const activeProjects = projects.data?.data.filter((project) => !project.archivedAt) ?? [];
  return (
    <article className="rounded-sm border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="min-w-0 break-words text-sm font-bold">{workspace.name}</h3>
        <Link
          to="/w/$workspaceId/members"
          params={{ workspaceId: workspace.id }}
          className="text-xs text-indigo hover:underline"
        >
          メンバー
        </Link>
      </div>
      {projects.isPending ? (
        <LoadingState label="プロジェクトを読み込み中…" />
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
      ) : activeProjects.length ? (
        <ul className="mt-3 flex flex-wrap gap-3">
          {activeProjects.map((project) => (
            <li key={project.id}>
              <Link
                to="/w/$workspaceId/p/$projectId"
                params={{ workspaceId: workspace.id, projectId: project.id }}
                className="text-sm text-indigo hover:underline"
              >
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-subtle-foreground">
          アクティブなプロジェクトがありません。
        </p>
      )}
    </article>
  );
}
