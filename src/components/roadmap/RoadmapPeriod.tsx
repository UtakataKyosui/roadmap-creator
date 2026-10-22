import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Pencil } from "lucide-react";
import { useId, useState } from "react";
import { invalidateRoadmaps } from "@/api/cache";
import { apiErrorMessage } from "@/api/error-message";
import {
  getGetRoadmapQueryKey,
  useGetRoadmap,
  useUpdateRoadmap,
} from "@/api/generated/endpoints/roadmaps/roadmaps";
import type { Roadmap } from "@/api/generated/models";
import { Button } from "@/components/ui/button";
import { roadmapPeriodLabel, validateRoadmapPeriod, type RoadmapPeriod } from "@/domain/roadmap";

export function PeriodFields({
  value,
  onChange,
  disabled,
  errorId,
}: {
  value: RoadmapPeriod;
  onChange: (value: RoadmapPeriod) => void;
  disabled: boolean;
  errorId?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap gap-3">
      {(
        [
          ["startDate", "開始日"],
          ["dueDate", "完了予定日"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-${key}`} className="text-xs font-semibold">
            {label}
          </label>
          <input
            id={`${id}-${key}`}
            type="date"
            value={value[key] ?? ""}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, [key]: event.target.value || null })}
            aria-invalid={errorId ? true : undefined}
            aria-describedby={errorId}
            className="h-9 rounded-sm border border-border-strong bg-surface px-3 text-xs focus:border-indigo focus:outline-none"
          />
        </div>
      ))}
    </div>
  );
}

export function RoadmapPeriodEditor({ roadmap: initial }: { roadmap: Roadmap }) {
  const query = useGetRoadmap(initial.workspaceId, initial.id);
  const roadmap = query.data?.data ?? initial;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<RoadmapPeriod>({
    startDate: roadmap.startDate ?? null,
    dueDate: roadmap.dueDate ?? null,
  });
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(roadmap.version);
  const errorId = useId();
  const update = useUpdateRoadmap();
  const queryClient = useQueryClient();

  if (!editing)
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays aria-hidden className="size-4" />
        <span>{roadmapPeriodLabel(roadmap)}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setValue({ startDate: roadmap.startDate ?? null, dueDate: roadmap.dueDate ?? null });
            setVersion(roadmap.version);
            setError(null);
            setEditing(true);
          }}
        >
          <Pencil aria-hidden />
          期間を設定
        </Button>
      </div>
    );

  return (
    <form
      className="mt-3 space-y-3 rounded-sm border bg-surface-sunken p-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (update.isPending) return;
        const invalid = validateRoadmapPeriod(value);
        setError(invalid);
        if (invalid) return;
        update.mutate(
          { workspaceId: roadmap.workspaceId, roadmapId: roadmap.id, data: { version, ...value } },
          {
            onSuccess: (response) => {
              queryClient.setQueryData(
                getGetRoadmapQueryKey(roadmap.workspaceId, roadmap.id),
                response,
              );
              setEditing(false);
            },
            onError: (cause) => setError(apiErrorMessage(cause)),
            onSettled: () =>
              invalidateRoadmaps(queryClient, roadmap.workspaceId, roadmap.projectId, roadmap.id),
          },
        );
      }}
    >
      <PeriodFields
        value={value}
        onChange={setValue}
        disabled={update.isPending}
        errorId={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={update.isPending}>
          {update.isPending ? "保存中…" : "期間を保存"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={update.isPending}
          onClick={() => setEditing(false)}
        >
          キャンセル
        </Button>
        {update.error?.isVersionConflict && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue({ startDate: roadmap.startDate ?? null, dueDate: roadmap.dueDate ?? null });
              setVersion(roadmap.version);
              setError(null);
              update.reset();
            }}
          >
            最新の期間を読み直す
          </Button>
        )}
      </div>
    </form>
  );
}
