import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useId, useState } from "react";
import type { Roadmap } from "@/api/generated/models";
import { invalidateRoadmaps } from "@/api/cache";
import { apiErrorMessage } from "@/api/error-message";
import {
  getGetRoadmapQueryKey,
  useCreateRoadmap,
  useListRoadmaps,
  useUpdateRoadmap,
} from "@/api/generated/endpoints/roadmaps/roadmaps";
import { ApiError } from "@/api/http";
import { EmptyState, ErrorState, LoadingState } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";
import { validateRoadmapName } from "@/domain/roadmap";

type Scope = { workspaceId: string; projectId: string };

// 保存失敗時は入力を保持し、検証エラーは項目に、それ以外はフォーム全体に表示する。
const failureMessage = (error: unknown) => {
  if (error instanceof ApiError && error.isValidationFailed) {
    return error.details[0]?.message ?? apiErrorMessage(error);
  }
  return apiErrorMessage(error);
};

function NameField({
  initial = "",
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const shown = localError ?? error;

  return (
    <form
      className="flex flex-wrap items-start gap-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const result = validateRoadmapName(value);
        setLocalError(result.ok ? null : result.message);
        if (result.ok) onSubmit(result.name);
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="sr-only">
          ロードマップの名称
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? errorId : undefined}
          autoFocus={onCancel !== undefined}
          placeholder="ロードマップの名称"
          className="h-9 w-72 rounded-lg border bg-background px-3 text-sm"
        />
        {shown && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {shown}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "保存中…" : submitLabel}
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          キャンセル
        </Button>
      )}
    </form>
  );
}

function RoadmapRow({ roadmap, scope }: { roadmap: Roadmap; scope: Scope }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const update = useUpdateRoadmap();

  if (editing) {
    return (
      <li>
        <NameField
          initial={roadmap.name}
          submitLabel="保存"
          pending={update.isPending}
          error={update.error ? failureMessage(update.error) : null}
          onCancel={() => {
            update.reset();
            setEditing(false);
          }}
          onSubmit={(name) =>
            update.mutate(
              {
                workspaceId: scope.workspaceId,
                roadmapId: roadmap.id,
                data: { version: roadmap.version, name },
              },
              {
                onSuccess: (response) => {
                  if (response.status === 200) {
                    queryClient.setQueryData(
                      getGetRoadmapQueryKey(scope.workspaceId, roadmap.id),
                      response,
                    );
                  }
                  setEditing(false);
                },
                // 競合時は最新の状態を取得し直す。入力は保持される。
                onSettled: () =>
                  invalidateRoadmaps(queryClient, scope.workspaceId, scope.projectId, roadmap.id),
              },
            )
          }
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2">
      <Link
        to="/w/$workspaceId/p/$projectId/r/$roadmapId/board"
        params={{ ...scope, roadmapId: roadmap.id }}
        className="underline"
      >
        {roadmap.name}
      </Link>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`「${roadmap.name}」の名称を編集`}
        onClick={() => setEditing(true)}
      >
        <Pencil />
      </Button>
    </li>
  );
}

export function RoadmapManager({ workspaceId, projectId }: Scope) {
  const scope = { workspaceId, projectId };
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const roadmaps = useListRoadmaps(workspaceId, projectId);
  const create = useCreateRoadmap();

  const submitCreate = (name: string) =>
    create.mutate(
      { workspaceId, projectId, data: { name } },
      {
        onSuccess: async (response) => {
          await invalidateRoadmaps(queryClient, workspaceId, projectId);
          if (response.status !== 201) return;
          // 作成後はそのロードマップのボードへ進み、タスク追加に移れるようにする。
          await navigate({
            to: "/w/$workspaceId/p/$projectId/r/$roadmapId/board",
            params: { ...scope, roadmapId: response.data.id },
          });
        },
      },
    );

  if (roadmaps.isPending) return <LoadingState />;
  if (roadmaps.error)
    return <ErrorState error={roadmaps.error} onRetry={() => roadmaps.refetch()} />;

  const items = roadmaps.data.status === 200 ? roadmaps.data.data.filter((r) => !r.archivedAt) : [];

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <EmptyState
          title="ロードマップがまだありません"
          description="名称をつけて作成すると、タスクを追加できます。"
        />
      ) : (
        <ul className="space-y-2">
          {items.map((roadmap) => (
            <RoadmapRow key={roadmap.id} roadmap={roadmap} scope={scope} />
          ))}
        </ul>
      )}
      <section aria-label="ロードマップの作成">
        <h2 className="mb-2 text-sm font-medium">新しいロードマップ</h2>
        <NameField
          submitLabel="作成"
          pending={create.isPending}
          error={create.error ? failureMessage(create.error) : null}
          onSubmit={submitCreate}
        />
      </section>
    </div>
  );
}
