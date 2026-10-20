import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { invalidateTasks } from "@/api/cache";
import { apiErrorMessage } from "@/api/error-message";
import { useCreateTask, useGetTask, useUpdateTask } from "@/api/generated/endpoints/tasks/tasks";
import type { Task, TaskCreate, TaskStatus } from "@/api/generated/models";
import { ApiError } from "@/api/http";
import { initialTaskInput, taskInput, taskPatch, validateTaskInput } from "@/domain/task-editor";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  progressPercent,
} from "@/domain/task";
import { useWorkspaceOptions } from "@/hooks/use-workspace-options";
import { ErrorState, LoadingState } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";

export type TaskScope = { workspaceId: string; roadmapId: string };
export type EditorSelection = { taskId: string } | { status: TaskStatus };

function Modal({
  children,
  onClose,
  busy,
}: {
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto max-h-[90dvh] w-[min(42rem,calc(100%-2rem))] overflow-auto rounded-xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/45"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={titleId} className="mb-4 text-xl font-semibold">
        タスク
      </h2>
      {children}
    </dialog>
  );
}

export function TaskEditor({
  scope,
  selection,
  onClose,
}: {
  scope: TaskScope;
  selection: EditorSelection;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal busy={busy} onClose={onClose}>
      {"taskId" in selection ? (
        <TaskDetail scope={scope} taskId={selection.taskId} onClose={onClose} onBusy={setBusy} />
      ) : (
        <TaskForm scope={scope} status={selection.status} onClose={onClose} onBusy={setBusy} />
      )}
    </Modal>
  );
}

function TaskDetail({
  scope,
  taskId,
  onClose,
  onBusy,
}: {
  scope: TaskScope;
  taskId: string;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const query = useGetTask(scope.workspaceId, scope.roadmapId, taskId);
  const [revision, setRevision] = useState(0);
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
        <Button onClick={onClose}>閉じる</Button>
      </>
    );
  if (query.data.status !== 200) return null;
  return (
    <TaskForm
      key={revision}
      scope={scope}
      task={query.data.data}
      onClose={onClose}
      onBusy={onBusy}
      onReload={async () => {
        const result = await query.refetch();
        if (result.isSuccess) setRevision((value) => value + 1);
      }}
    />
  );
}

function TaskForm({
  scope,
  task,
  status = "todo",
  onClose,
  onBusy,
  onReload,
}: {
  scope: TaskScope;
  task?: Task;
  status?: TaskStatus;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
  onReload?: () => Promise<void>;
}) {
  // 再取得でフォームを自動的に置き換えず、編集開始時のversionと値を保持する。
  const [original] = useState(task);
  const [input, setInput] = useState<TaskCreate>(() =>
    task ? taskInput(task) : initialTaskInput(status),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reloading, setReloading] = useState(false);
  const submitting = useRef(false);
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const create = useCreateTask();
  const update = useUpdateTask();
  const options = useWorkspaceOptions(scope.workspaceId);
  const failure = create.error ?? update.error;
  const pending = create.isPending || update.isPending || reloading;
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const field = (key: keyof TaskCreate) => ({
    id: `${formId}-${key}`,
    "aria-invalid": errors[key] ? (true as const) : undefined,
    "aria-describedby": errors[key] ? `${formId}-${key}-error` : undefined,
  });
  const message = (key: keyof TaskCreate) =>
    errors[key] && (
      <p id={`${formId}-${key}-error`} role="alert" className="text-sm text-destructive">
        {errors[key]}
      </p>
    );
  const change = <K extends keyof TaskCreate>(key: K, value: TaskCreate[K]) =>
    setInput((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (submitting.current) return;
    const result = validateTaskInput(input);
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.path[0] === "title" && input.title.trim() === ""
              ? "タイトルを入力してください"
              : issue.path[0] === "dueDate"
                ? "開始日以前にならない期限を入力してください"
                : "入力内容と文字数を確認してください",
          ]),
        ),
      );
      return;
    }
    submitting.current = true;
    onBusy(true);
    setErrors({});
    try {
      if (original)
        await update.mutateAsync({
          ...scope,
          taskId: original.id,
          data: taskPatch(original, result.data),
        });
      else await create.mutateAsync({ ...scope, data: result.data });
      await invalidateTasks(client, scope.workspaceId, scope.roadmapId, original?.id);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.isValidationFailed) {
        setErrors(
          Object.fromEntries(
            error.details.map((detail) => [
              detail.path.split("/")[1],
              "入力内容を確認してください",
            ]),
          ),
        );
      }
    } finally {
      submitting.current = false;
      onBusy(false);
    }
  };
  const inputClass = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {original
          ? "タスクの基本情報を編集します。"
          : "新しいアイテムを追加し、ボードで管理します。"}
      </p>
      {options.isPending && <p role="status">選択肢を読み込み中…</p>}
      {options.error && (
        <p role="alert">
          担当者・ラベルを取得できませんでした。
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void client.invalidateQueries();
            }}
          >
            再試行
          </Button>
        </p>
      )}
      <fieldset disabled={pending} className="space-y-4">
        <div>
          <label htmlFor={`${formId}-title`}>タイトル（必須）</label>
          <input
            {...field("title")}
            ref={titleRef}
            className={inputClass}
            value={input.title}
            onChange={(e) => change("title", e.target.value)}
          />
          {message("title")}
        </div>
        <div>
          <label htmlFor={`${formId}-description`}>説明</label>
          <textarea
            {...field("description")}
            className={inputClass}
            rows={3}
            value={input.description ?? ""}
            onChange={(e) => change("description", e.target.value || null)}
          />
          {message("description")}
        </div>
        <div>
          <label htmlFor={`${formId}-assigneeId`}>担当者</label>
          <select
            {...field("assigneeId")}
            className={inputClass}
            disabled={options.isPending || !!options.error}
            value={input.assigneeId ?? ""}
            onChange={(e) => change("assigneeId", e.target.value || null)}
          >
            <option value="">未割当</option>
            {options.members.map(({ user }) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          {message("assigneeId")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["startDate", "dueDate"] as const).map((key) => (
            <div key={key}>
              <label htmlFor={`${formId}-${key}`}>{key === "startDate" ? "開始日" : "期限"}</label>
              <input
                {...field(key)}
                type="date"
                className={inputClass}
                value={input[key] ?? ""}
                onChange={(e) => change(key, e.target.value || null)}
              />
              {message(key)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${formId}-status`}>ステータス</label>
            <select
              {...field("status")}
              className={inputClass}
              value={input.status}
              onChange={(e) => {
                const value = TASK_STATUSES.find((s) => s === e.target.value);
                if (value) change("status", value);
              }}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-priority`}>優先度</label>
            <select
              {...field("priority")}
              className={inputClass}
              value={input.priority}
              onChange={(e) => {
                const value = TASK_PRIORITIES.find((p) => p === e.target.value);
                if (value) change("priority", value);
              }}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset disabled={options.isPending || !!options.error}>
          <legend>ラベル</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {options.labels.map((label) => (
              <label key={label.id} className="inline-flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={input.labelIds?.includes(label.id) ?? false}
                  onChange={(e) =>
                    change(
                      "labelIds",
                      e.target.checked
                        ? [...(input.labelIds ?? []), label.id]
                        : input.labelIds?.filter((id) => id !== label.id),
                    )
                  }
                />
                {label.name}
              </label>
            ))}
            {!options.isPending && !options.error && options.labels.length === 0 && (
              <span className="text-sm">ラベルがありません</span>
            )}
          </div>
          {message("labelIds")}
        </fieldset>
      </fieldset>
      <p className="text-sm text-muted-foreground">
        進捗 {progressPercent(input.status ?? "todo")}%
        {original && ` · コメント ${original.commentCount}`}
      </p>
      {failure && (
        <div role="alert" className="text-sm text-destructive">
          {apiErrorMessage(failure)}
          {failure instanceof ApiError && failure.isVersionConflict && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={async () => {
                setReloading(true);
                onBusy(true);
                try {
                  await onReload?.();
                } finally {
                  setReloading(false);
                  onBusy(false);
                }
              }}
            >
              最新の内容を読み込む（入力を置き換えます）
            </Button>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
          キャンセル
        </Button>
        <Button type="submit" disabled={pending || options.isPending || !!options.error}>
          {pending ? "保存中…" : original ? "保存" : "作成"}
        </Button>
      </div>
    </form>
  );
}
