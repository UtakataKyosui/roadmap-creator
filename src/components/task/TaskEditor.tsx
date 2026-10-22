import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  CircleAlert,
  CircleDot,
  Flag,
  RefreshCw,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { invalidateTasks } from "@/api/cache";
import { apiErrorMessage } from "@/api/error-message";
import { useCreateTask, useGetTask, useUpdateTask } from "@/api/generated/endpoints/tasks/tasks";
import type { Task, TaskCreate, TaskStatus } from "@roadmapper/api-contract/models";
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
import { ErrorState, LoadingState, Notice } from "@/components/state/StateViews";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TaskScope = { workspaceId: string; roadmapId: string };
export type EditorSelection = { taskId: string } | { status: TaskStatus };

function Modal({
  title,
  children,
  onClose,
  busy,
}: {
  title: string;
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
      className="relative m-auto max-h-[90dvh] w-[min(40rem,calc(100%-2rem))] overflow-auto rounded-lg bg-surface p-0 text-foreground shadow-[0_16px_40px_#15181e33] backdrop:bg-[#15181e]/45"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={titleId} className="px-6 pt-5 pr-14 text-lg font-bold">
        {title}
      </h2>
      {children}
      {/* 初期フォーカスがタイトル入力に当たるよう、閉じるボタンは内容の後に置く。 */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="閉じる"
        className="absolute top-4 right-4"
        disabled={busy}
        onClick={onClose}
      >
        <X aria-hidden />
      </Button>
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
    <Modal
      title={"taskId" in selection ? "学習ステップを編集" : "学習ステップを追加"}
      busy={busy}
      onClose={onClose}
    >
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
      <div className="px-6 pb-6">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
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
      <p
        id={`${formId}-${key}-error`}
        role="alert"
        className="mt-1.5 flex items-start gap-1 text-xs text-danger"
      >
        <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
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
  const inputClass =
    "h-9 w-full rounded-sm border border-border-strong bg-surface-sunken px-3 text-[13px] focus:border-indigo focus:bg-surface focus:outline-none aria-invalid:border-destructive disabled:opacity-60";
  const labelClass = "mb-1.5 block text-xs font-semibold";
  const select = (icon: ReactNode, control: ReactNode) => (
    <span className="relative block [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:top-1/2 [&>svg]:size-3.5 [&>svg]:-translate-y-1/2 [&>svg]:text-subtle-foreground">
      {icon}
      {control}
      <ChevronDown aria-hidden className="right-3" />
    </span>
  );
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-3.5 px-6 pt-1 pb-4">
        <p className="text-xs text-subtle-foreground">
          {original
            ? `学習内容や予定を見直しましょう。進捗 ${progressPercent(input.status ?? "todo")}% · コメント ${original.commentCount}`
            : "目標に向けて、無理なく取り組める一歩を決めましょう。"}
        </p>
        {failure && (
          <div
            role="alert"
            className={cn(
              "flex flex-wrap items-center gap-2.5 rounded-sm border px-3 py-2.5 text-xs",
              failure instanceof ApiError && failure.isVersionConflict
                ? "border-[#f3d3a4] bg-amber-tint text-amber"
                : "border-[#f6c9c5] bg-danger-tint text-danger",
            )}
          >
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">{apiErrorMessage(failure)}</span>
            {failure instanceof ApiError && failure.isVersionConflict && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#f3d3a4] text-amber"
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
                <RefreshCw aria-hidden />
                最新の内容を読み込む（入力を置き換えます）
              </Button>
            )}
          </div>
        )}
        {options.isPending && (
          <Notice tone="progress" role="status">
            選択肢を読み込み中…
          </Notice>
        )}
        {options.error && (
          <Notice tone="error" role="alert">
            担当者・ラベルを取得できませんでした。
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                void client.invalidateQueries();
              }}
            >
              再試行
            </Button>
          </Notice>
        )}
        <fieldset disabled={pending} className="space-y-3.5">
          <div>
            <label className={labelClass} htmlFor={`${formId}-title`}>
              学ぶこと・取り組むこと（必須）
            </label>
            <input
              {...field("title")}
              ref={titleRef}
              placeholder="例：参考書の第1章を読んで、練習問題を解く"
              className={inputClass}
              value={input.title}
              onChange={(e) => change("title", e.target.value)}
            />
            {message("title")}
          </div>
          <div>
            <label className={labelClass} htmlFor={`${formId}-description`}>
              説明
            </label>
            <textarea
              {...field("description")}
              className={cn(inputClass, "h-auto py-2.5 leading-normal")}
              rows={3}
              placeholder="使う教材や、どこまでできたら完了にするかを書いておきましょう"
              value={input.description ?? ""}
              onChange={(e) => change("description", e.target.value || null)}
            />
            {message("description")}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor={`${formId}-assigneeId`}>
                担当者
              </label>
              {select(
                <User aria-hidden className="left-3" />,
                <select
                  {...field("assigneeId")}
                  className={cn(inputClass, "appearance-none pr-8 pl-9")}
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
                </select>,
              )}
              {message("assigneeId")}
            </div>
            {(["startDate", "dueDate"] as const).map((key) => (
              <div key={key}>
                <label className={labelClass} htmlFor={`${formId}-${key}`}>
                  {key === "startDate" ? "開始日" : "期限"}
                </label>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`${formId}-status`}>
                ステータス
              </label>
              {select(
                <CircleDot aria-hidden className="left-3" />,
                <select
                  {...field("status")}
                  className={cn(inputClass, "appearance-none pr-8 pl-9")}
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
                </select>,
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-priority`}>
                優先度
              </label>
              {select(
                <Flag aria-hidden className="left-3" />,
                <select
                  {...field("priority")}
                  className={cn(inputClass, "appearance-none pr-8 pl-9")}
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
                </select>,
              )}
            </div>
          </div>
          <fieldset disabled={options.isPending || !!options.error}>
            <legend className={labelClass}>ラベル</legend>
            <div className="flex flex-wrap gap-2">
              {options.labels.map((label) => {
                const checked = input.labelIds?.includes(label.id) ?? false;
                return (
                  <label
                    key={label.id}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      checked
                        ? "border-indigo bg-indigo-tint font-semibold text-indigo"
                        : "border-border-strong text-muted-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-indigo"
                      checked={checked}
                      onChange={(e) =>
                        change(
                          "labelIds",
                          e.target.checked
                            ? [...(input.labelIds ?? []), label.id]
                            : input.labelIds?.filter((id) => id !== label.id),
                        )
                      }
                    />
                    <span
                      aria-hidden
                      className="size-[7px] rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </label>
                );
              })}
              {!options.isPending && !options.error && options.labels.length === 0 && (
                <span className="text-xs text-subtle-foreground">ラベルがありません</span>
              )}
            </div>
            {message("labelIds")}
          </fieldset>
        </fieldset>
      </div>
      <div className="flex justify-end gap-2 border-t bg-surface-sunken px-6 py-3.5">
        <Button type="button" variant="outline" size="lg" disabled={pending} onClick={onClose}>
          キャンセル
        </Button>
        <Button
          type="submit"
          size="lg"
          className="px-4"
          disabled={pending || options.isPending || !!options.error}
        >
          {pending ? "保存中…" : original ? "保存" : "作成"}
        </Button>
      </div>
    </form>
  );
}
