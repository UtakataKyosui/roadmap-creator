import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CircleAlert, Map as MapIcon, Pencil, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  label,
  hint,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  label?: string;
  hint?: string;
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
      className="flex flex-1 flex-wrap items-start gap-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const result = validateRoadmapName(value);
        setLocalError(result.ok ? null : result.message);
        if (result.ok) onSubmit(result.name);
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={inputId} className={label ? "text-xs font-semibold" : "sr-only"}>
          {label ?? "ロードマップの名称"}
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && onCancel && !pending) {
              event.preventDefault();
              onCancel();
            }
          }}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? errorId : undefined}
          autoFocus={onCancel !== undefined}
          placeholder="ロードマップの名称"
          className="h-9 w-full rounded-sm border border-border-strong bg-surface px-3 text-[13px] focus:border-indigo focus:outline-none aria-invalid:border-destructive"
        />
        {shown ? (
          <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-danger">
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            {shown}
          </p>
        ) : (
          hint && <p className="text-[11px] text-subtle-foreground">{hint}</p>
        )}
      </div>
      <div className={cn("flex gap-2", label && "pt-[22px]")}>
        <Button type="submit" size="lg" disabled={pending}>
          {!onCancel && <Plus aria-hidden />}
          {pending ? "保存中…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel} disabled={pending}>
            キャンセル
          </Button>
        )}
      </div>
    </form>
  );
}

const ICON_TONE = ["text-indigo", "text-teal", "text-amber"];

function RoadmapIcon({ index }: { index: number }) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-subtle"
    >
      <MapIcon className={cn("size-4", ICON_TONE[index % ICON_TONE.length])} />
    </span>
  );
}

function RoadmapRow({ roadmap, scope, index }: { roadmap: Roadmap; scope: Scope; index: number }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const update = useUpdateRoadmap();

  if (editing) {
    return (
      <li className="flex items-start gap-3 bg-surface-sunken px-4 py-3">
        <RoadmapIcon index={index} />
        <NameField
          initial={roadmap.name}
          hint="Enterで保存、Escでキャンセル"
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
    <li className="flex h-14 items-center gap-3 px-4">
      <RoadmapIcon index={index} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{roadmap.name}</span>
      <Link
        to="/w/$workspaceId/p/$projectId/r/$roadmapId/board"
        params={{ ...scope, roadmapId: roadmap.id }}
        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo hover:underline"
        aria-label={`「${roadmap.name}」のボードを開く`}
      >
        ボードを開く
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
      <Button
        variant="outline"
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
  const listId = useId();
  const createId = useId();

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
    <div className="flex max-w-3xl flex-col gap-5">
      {items.length === 0 ? (
        <div className="rounded-md border bg-surface">
          <EmptyState
            title="ロードマップがまだありません"
            description="名称をつけて作成すると、タスクを追加できます。"
          />
        </div>
      ) : (
        <section aria-labelledby={listId} className="overflow-hidden rounded-md border bg-surface">
          <h2
            id={listId}
            className="flex items-center gap-2 border-b bg-surface-sunken px-4 py-3 text-xs font-semibold text-muted-foreground"
          >
            ロードマップ
            <span className="rounded-full bg-surface-subtle px-[7px] text-[11px]">
              {items.length}
            </span>
          </h2>
          <ul className="divide-y">
            {items.map((roadmap, index) => (
              <RoadmapRow key={roadmap.id} roadmap={roadmap} scope={scope} index={index} />
            ))}
          </ul>
        </section>
      )}
      <section
        aria-labelledby={createId}
        className="flex flex-col gap-3 rounded-md border bg-surface p-4"
      >
        <div>
          <h2 id={createId} className="text-sm font-bold">
            新しいロードマップ
          </h2>
          <p className="mt-1 text-xs text-subtle-foreground">
            作成すると、そのロードマップのボードが開きます。
          </p>
        </div>
        <NameField
          label="ロードマップの名称"
          submitLabel="作成"
          pending={create.isPending}
          error={create.error ? failureMessage(create.error) : null}
          onSubmit={submitCreate}
        />
      </section>
    </div>
  );
}
