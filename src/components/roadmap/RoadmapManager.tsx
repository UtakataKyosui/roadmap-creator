import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CircleAlert,
  Map as MapIcon,
  Pencil,
  Plus,
  Target,
} from "lucide-react";
import { useId, useState } from "react";
import type { Roadmap } from "@roadmapper/api-contract/models";
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
import {
  roadmapPeriodLabel,
  validateRoadmapName,
  validateRoadmapPeriod,
  type RoadmapPeriod,
} from "@roadmapper/domain/roadmap";
import { PeriodFields } from "./RoadmapPeriod";
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
  initialPeriod,
  label,
  hint,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  initialPeriod?: Partial<RoadmapPeriod>;
  label?: string;
  hint?: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (name: string, period: RoadmapPeriod) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [period, setPeriod] = useState<RoadmapPeriod>({
    startDate: initialPeriod?.startDate ?? null,
    dueDate: initialPeriod?.dueDate ?? null,
  });
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
        const dateError = validateRoadmapPeriod(period);
        setLocalError(result.ok ? dateError : result.message);
        if (result.ok && !dateError) onSubmit(result.name, period);
      }}
    >
      <div className="flex min-w-0 flex-1 basis-full flex-col gap-1.5 sm:basis-0">
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
          placeholder="例：TOEIC 800点を目指す"
          className="h-9 w-full rounded-sm border border-border-strong bg-surface px-3 text-[13px] focus:border-indigo focus:outline-none aria-invalid:border-destructive"
        />
        <PeriodFields
          value={period}
          onChange={setPeriod}
          disabled={pending}
          errorId={shown ? errorId : undefined}
        />
        {shown ? (
          <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-danger">
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            {shown}
          </p>
        ) : (
          hint && <p className="text-[11px] text-subtle-foreground">{hint}</p>
        )}
        {!onCancel && (
          <div className="mt-2 flex flex-wrap gap-2">
            {["TOEIC 800点を目指す", "基本情報技術者に合格する", "チームで英会話を身につける"].map(
              (example) => (
                <button
                  key={example}
                  type="button"
                  disabled={pending}
                  className="rounded-full border bg-surface-sunken px-3 py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-indigo hover:text-indigo"
                  onClick={() => setValue(example)}
                >
                  {example}
                </button>
              ),
            )}
          </div>
        )}
      </div>
      <div className={cn("flex gap-2", label && "sm:pt-[22px]")}>
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
          initialPeriod={roadmap}
          hint="Enterで保存、Escでキャンセル"
          submitLabel="保存"
          pending={update.isPending}
          error={update.error ? failureMessage(update.error) : null}
          onCancel={() => {
            update.reset();
            setEditing(false);
          }}
          onSubmit={(name, period) =>
            update.mutate(
              {
                workspaceId: scope.workspaceId,
                roadmapId: roadmap.id,
                data: { version: roadmap.version, name, ...period },
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
    <li className="flex min-h-24 flex-wrap items-center gap-3 px-5 py-4">
      <RoadmapIcon index={index} />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[10px] tracking-wider text-subtle-foreground">目指しているゴール</p>
        <span className="block truncate text-sm font-semibold">{roadmap.name}</span>
        <p className="mt-1 text-xs text-muted-foreground">{roadmapPeriodLabel(roadmap)}</p>
      </div>
      <Link
        to="/w/$workspaceId/p/$projectId/r/$roadmapId/map"
        params={{ ...scope, roadmapId: roadmap.id }}
        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo hover:underline"
        aria-label={`「${roadmap.name}」のロードマップを開く`}
      >
        学びを続ける
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
      <Button
        variant="outline"
        size="icon"
        aria-label={`「${roadmap.name}」の名称と期間を編集`}
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

  const submitCreate = (name: string, period: RoadmapPeriod) =>
    create.mutate(
      { workspaceId, projectId, data: { name, ...period } },
      {
        onSuccess: async (response) => {
          await invalidateRoadmaps(queryClient, workspaceId, projectId);
          if (response.status !== 201) return;
          // 作成後はマップへ進み、目標に必要な学習ステップを追加する。
          await navigate({
            to: "/w/$workspaceId/p/$projectId/r/$roadmapId/map",
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="roadmap-hero">
        <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-indigo">
          <BookOpen className="size-4" aria-hidden /> LEARN AT YOUR OWN PACE
        </p>
        <h1 className="text-2xl font-bold leading-relaxed md:text-3xl">
          なりたい自分への道を、描こう。
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
          資格の合格も、新しいスキルも。目標までの道のりを小さなステップに分けて、自分やチームのペースで進めましょう。
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-indigo">
          <span className="flex items-center gap-2">
            <Target className="size-4" aria-hidden />
            目標を決める
          </span>
          <span className="flex items-center gap-2">
            <MapIcon className="size-4" aria-hidden />
            学びの道筋をつくる
          </span>
          <span className="flex items-center gap-2">
            <ArrowRight className="size-4" aria-hidden />
            一歩ずつ進める
          </span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border bg-surface">
          <EmptyState
            title="ロードマップがまだありません"
            description="まずは、たどり着きたい目標を一つ決めてみましょう。"
          />
        </div>
      ) : (
        <section aria-labelledby={listId} className="overflow-hidden rounded-md border bg-surface">
          <h2
            id={listId}
            className="flex items-center gap-2 border-b bg-surface-sunken px-4 py-3 text-xs font-semibold text-muted-foreground"
          >
            取り組んでいるロードマップ
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
        className="flex flex-col gap-5 rounded-lg border bg-surface p-6"
      >
        <div>
          <h2 id={createId} className="text-sm font-bold">
            次は、何を目指しますか？
          </h2>
          <p className="mt-1 text-xs text-subtle-foreground">
            達成したい目標に名前をつけましょう。作成後に、必要な学習ステップを追加できます。
          </p>
        </div>
        <NameField
          label="達成したい目標"
          submitLabel="ロードマップを作成"
          pending={create.isPending}
          error={create.error ? failureMessage(create.error) : null}
          onSubmit={submitCreate}
        />
      </section>
    </div>
  );
}
