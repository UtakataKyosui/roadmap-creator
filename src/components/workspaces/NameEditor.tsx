import { useId, useState } from "react";
import { apiErrorMessage } from "@/api/error-message";
import { ApiError } from "@/api/http";
import { Button } from "@roadmapper/ui/components/ui/button";

export function NameEditor({
  initial,
  label,
  onSave,
  onCancel,
  onRefresh,
}: {
  initial: { name: string; version: number };
  label: string;
  onSave: (input: { name: string; version: number }) => Promise<void>;
  onCancel: () => void;
  onRefresh: () => Promise<unknown>;
}) {
  const [name, setName] = useState(initial.name);
  const [version, setVersion] = useState(initial.version);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const id = useId();
  return (
    <form
      className="w-full space-y-2"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const trimmed = name.trim();
        if (!trimmed || name.length > 100) {
          setError(!trimmed ? "名称を入力してください" : "名称は100文字以内で入力してください");
          return;
        }
        setPending(true);
        setError(null);
        try {
          await onSave({ name: trimmed, version });
        } catch (cause) {
          setError(apiErrorMessage(cause));
          const stale = cause instanceof ApiError && cause.isVersionConflict;
          setConflict(stale);
          if (stale) await onRefresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <label htmlFor={id} className="block text-xs font-semibold">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={name}
          autoFocus
          disabled={pending}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !pending) onCancel();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-9 min-w-0 flex-1 basis-48 rounded-sm border border-border-strong bg-surface px-3 text-sm focus:border-indigo focus:outline-none"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "保存中…" : "保存"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          キャンセル
        </Button>
        {conflict && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setName(initial.name);
              setVersion(initial.version);
              setError(null);
              setConflict(false);
            }}
          >
            最新の名称を読み直す
          </Button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
