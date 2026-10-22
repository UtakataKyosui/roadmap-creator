import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Mail, RefreshCw, UserPlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { apiErrorMessage } from "@/api/error-message";
import {
  getListInvitationsQueryKey,
  useCreateInvitation,
  useListInvitations,
  useResendInvitation,
  useRevokeInvitation,
} from "@/api/generated/endpoints/invitations/invitations";
import { useListWorkspaceMembers } from "@/api/generated/endpoints/workspaces/workspaces";
import type { Invitation, InvitationIssued, InvitationRole } from "@/api/generated/models";
import { ApiError } from "@/api/http";
import { AppHeader } from "@/components/layout/AppShell";
import { EmptyState, ErrorState, LoadingState, Notice } from "@/components/state/StateViews";
import { Avatar } from "@/components/task/Avatar";
import { Button } from "@/components/ui/button";
import {
  INVITATION_ROLES,
  INVITATION_STATUS_LABEL,
  INVITATION_STATUS_TONE,
  ROLE_LABEL,
  absoluteInviteUrl,
  canManageInvitations,
} from "@/domain/invitation";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-9 rounded-sm border border-border-strong bg-surface-sunken px-3 text-[13px] focus:border-indigo focus:bg-surface focus:outline-none";

// 招待に失敗した理由は、検証エラーならサーバーが返した文言を出し、それ以外はcodeで決めた文言を出す。
const failureMessage = (error: unknown) =>
  error instanceof ApiError && error.isValidationFailed
    ? (error.details[0]?.message ?? apiErrorMessage(error))
    : apiErrorMessage(error);

export function MembersPage({
  workspace,
  project,
  currentUserId,
}: {
  workspace: { id: string; name: string };
  project?: { id: string; name: string };
  currentUserId: string;
}) {
  const members = useListWorkspaceMembers(workspace.id);
  const list = members.data?.status === 200 ? members.data.data : undefined;
  const myRole = list?.find((member) => member.user.id === currentUserId)?.role;
  const manager = canManageInvitations(myRole);
  const [issued, setIssued] = useState<InvitationIssued>();

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader trail={[workspace.name, "メンバー"]} workspace={workspace} project={project} />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-surface px-6 py-3">
          <h1 className="text-xl font-bold">メンバー</h1>
          <p className="text-xs text-subtle-foreground">
            メンバーは、このワークスペースのロードマップとタスクを共有して閲覧・更新できます。
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
          {manager && (
            <section aria-labelledby="invite-heading" className="flex flex-col gap-3">
              <h2 id="invite-heading" className="text-sm font-bold">
                メンバーを招待
              </h2>
              <InviteForm workspaceId={workspace.id} onIssued={setIssued} />
              {issued && <IssuedNotice issued={issued} />}
            </section>
          )}
          <section aria-labelledby="members-heading" className="flex flex-col gap-3">
            <h2 id="members-heading" className="text-sm font-bold">
              参加中のメンバー
            </h2>
            {members.isPending ? (
              <LoadingState label="メンバーを読み込み中…" />
            ) : !list ? (
              <ErrorState error={members.error} onRetry={() => void members.refetch()} />
            ) : (
              <ul className="divide-y rounded-lg border bg-surface">
                {list.map(({ user, role }) => (
                  <li key={user.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar user={user} className="size-8 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-subtle-foreground">{user.email}</p>
                    </div>
                    <span className="rounded-[4px] bg-surface-subtle px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                      {ROLE_LABEL[role]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {manager && <InvitationList workspaceId={workspace.id} onIssued={setIssued} />}
        </div>
      </main>
    </div>
  );
}

function InviteForm({
  workspaceId,
  onIssued,
}: {
  workspaceId: string;
  onIssued: (issued: InvitationIssued) => void;
}) {
  const queryClient = useQueryClient();
  const create = useCreateInvitation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("member");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { workspaceId, data: { email: email.trim(), role } },
      {
        onSuccess: async (response) => {
          if (response.status !== 201) return;
          setEmail("");
          onIssued(response.data);
          await queryClient.invalidateQueries({
            queryKey: getListInvitationsQueryKey(workspaceId),
          });
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-60 flex-1 flex-col gap-1">
        <span className="text-xs font-semibold">メールアドレス</span>
        <input
          type="email"
          required
          value={email}
          maxLength={254}
          placeholder="name@example.com"
          aria-invalid={create.isError}
          className={fieldClass}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">役割</span>
        <select
          value={role}
          className={fieldClass}
          onChange={(event) => setRole(event.target.value as InvitationRole)}
        >
          {INVITATION_ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="lg" disabled={create.isPending || !email.trim()}>
        <UserPlus aria-hidden />
        {create.isPending ? "招待中…" : "招待する"}
      </Button>
      {create.isError && (
        <div className="w-full">
          <Notice tone="error" role="alert">
            {failureMessage(create.error)}
          </Notice>
        </div>
      )}
    </form>
  );
}

// 招待の作成・再送の結果。メール送信に失敗していても、URLを共有すれば受諾できる。
function IssuedNotice({ issued }: { issued: InvitationIssued }) {
  const [copied, setCopied] = useState(false);
  const url = absoluteInviteUrl(issued.inviteUrl, window.location.origin);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-surface p-3">
      <Notice tone={issued.emailSent ? "info" : "error"} role="status">
        {issued.emailSent
          ? `${issued.invitation.email} 宛に招待メールを送りました。`
          : `${issued.invitation.email} 宛のメールを送信できませんでした。下のURLを直接共有してください。`}
      </Notice>
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label="招待URL"
          value={url}
          className={cn(fieldClass, "min-w-0 flex-1")}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button variant="outline" size="lg" onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "コピーしました" : "コピー"}
        </Button>
      </div>
      <p className="text-[11px] text-subtle-foreground">
        このURLはいまだけ表示されます。招待先のメールアドレスでログインした人だけが参加できます。
      </p>
    </div>
  );
}

function InvitationList({
  workspaceId,
  onIssued,
}: {
  workspaceId: string;
  onIssued: (issued: InvitationIssued) => void;
}) {
  const queryClient = useQueryClient();
  const query = useListInvitations(workspaceId);
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const items = query.data?.status === 200 ? query.data.data : undefined;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey(workspaceId) });
  const failure = resend.error ?? revoke.error;

  const act = (invitation: Invitation, action: "resend" | "revoke") => {
    const variables = { workspaceId, invitationId: invitation.id };
    if (action === "resend") {
      resend.mutate(variables, {
        onSuccess: async (response) => {
          if (response.status === 200) onIssued(response.data);
          await refresh();
        },
      });
    } else {
      revoke.mutate(variables, { onSuccess: refresh });
    }
  };

  return (
    <section aria-labelledby="invitations-heading" className="flex flex-col gap-3">
      <h2 id="invitations-heading" className="text-sm font-bold">
        招待の状況
      </h2>
      {failure && (
        <Notice tone="error" role="alert">
          {failureMessage(failure)}
        </Notice>
      )}
      {query.isPending ? (
        <LoadingState label="招待を読み込み中…" />
      ) : !items ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Mail />}
          title="招待はまだありません"
          description="メールアドレスを入力して、メンバーを招待してください。"
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-surface">
          {items.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{invitation.email}</p>
                <p className="text-xs text-subtle-foreground">
                  {ROLE_LABEL[invitation.role]} ・ 有効期限{" "}
                  {new Date(invitation.expiresAt).toLocaleDateString("ja-JP")}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-semibold",
                  INVITATION_STATUS_TONE[invitation.status],
                )}
              >
                {INVITATION_STATUS_LABEL[invitation.status]}
              </span>
              {(invitation.status === "pending" || invitation.status === "expired") && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resend.isPending}
                  onClick={() => act(invitation, "resend")}
                >
                  <RefreshCw aria-hidden />
                  再送
                </Button>
              )}
              {invitation.status === "pending" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => act(invitation, "revoke")}
                >
                  <X aria-hidden />
                  取消
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
