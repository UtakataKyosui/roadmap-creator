import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Map as MapIcon } from "lucide-react";
import { useState } from "react";
import { signOut } from "@/api/auth-client";
import { clearUserCache } from "@/api/cache";
import { apiErrorMessage } from "@/api/error-message";
import {
  useAcceptInvitation,
  useGetInvitationPreview,
} from "@/api/generated/endpoints/invitations/invitations";
import { getListProjectsQueryOptions } from "@/api/generated/endpoints/projects/projects";
import { getListRoadmapsQueryOptions } from "@/api/generated/endpoints/roadmaps/roadmaps";
import { ApiError } from "@/api/http";
import { ErrorState, LoadingState, Notice } from "@/components/state/StateViews";
import { Button } from "@roadmapper/ui/components/ui/button";
import { INVITATION_STATUS_LABEL } from "@roadmapper/domain/invitation";

const unusable = {
  accepted: "この招待はすでに使われています。",
  revoked: "この招待は取り消されました。招待した人に新しい招待を依頼してください。",
  expired: "この招待は有効期限が切れています。招待した人に再送を依頼してください。",
} as const;

export function InvitationAcceptPage({ token, userEmail }: { token: string; userEmail: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const preview = useGetInvitationPreview(token, { query: { retry: false } });
  const accept = useAcceptInvitation();
  const [switching, setSwitching] = useState(false);
  const [switchFailed, setSwitchFailed] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<unknown>();
  const data = preview.data?.status === 200 ? preview.data.data : undefined;

  // 参加後は、共有されたワークスペースの最初のロードマップを開く。なければメンバー画面へ。
  const open = async (workspaceId: string) => {
    await queryClient.invalidateQueries();
    const projects = await queryClient.fetchQuery(getListProjectsQueryOptions(workspaceId));
    const project = projects.status === 200 ? projects.data.find((p) => !p.archivedAt) : undefined;
    const roadmaps = project
      ? await queryClient.fetchQuery(getListRoadmapsQueryOptions(workspaceId, project.id))
      : undefined;
    const roadmap = roadmaps?.status === 200 ? roadmaps.data.find((r) => !r.archivedAt) : undefined;
    if (project && roadmap) {
      await navigate({
        to: "/w/$workspaceId/p/$projectId/r/$roadmapId/board",
        params: { workspaceId, projectId: project.id, roadmapId: roadmap.id },
      });
    } else {
      await navigate({ to: "/w/$workspaceId/members", params: { workspaceId } });
    }
  };

  const join = async () => {
    setJoining(true);
    setJoinError(undefined);
    try {
      const response = await accept.mutateAsync({ token });
      if (response.status === 200) await open(response.data.workspaceId);
    } catch (error) {
      setJoinError(error);
    } finally {
      setJoining(false);
    }
  };

  // 別のアカウントでログインし直す。ログイン後はこの画面へ戻る。
  const switchAccount = async () => {
    setSwitching(true);
    setSwitchFailed(false);
    try {
      await signOut();
      clearUserCache(queryClient);
      await router.navigate({
        to: "/login",
        search: { redirect: `/invitations/${token}` },
        replace: true,
      });
    } catch {
      setSwitchFailed(true);
    } finally {
      setSwitching(false);
    }
  };

  const acceptError = joinError;
  const reason =
    acceptError instanceof ApiError && acceptError.isValidationFailed
      ? (acceptError.details[0]?.message ?? apiErrorMessage(acceptError))
      : acceptError instanceof ApiError && acceptError.status === 403
        ? "この招待は別のメールアドレス宛です。"
        : acceptError
          ? apiErrorMessage(acceptError)
          : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-subtle p-6">
      <section className="flex w-full max-w-sm flex-col gap-5 rounded-lg border bg-surface p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-[8px] bg-indigo text-white">
            <MapIcon aria-hidden className="size-5" />
          </span>
          <span className="text-lg font-semibold">Roadmap Studio</span>
        </div>
        {preview.isPending ? (
          <LoadingState label="招待を確認しています…" />
        ) : preview.error instanceof ApiError && preview.error.status === 404 ? (
          <Notice tone="error" role="alert">
            招待が見つかりません。URLを確認するか、招待した人に再送を依頼してください。
          </Notice>
        ) : !data ? (
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-bold">「{data.workspaceName}」への招待</h1>
              <p className="text-xs leading-normal text-subtle-foreground">
                参加すると、このワークスペースのロードマップとタスクを共有して閲覧・更新できます。
              </p>
            </div>
            {reason && (
              <Notice tone="error" role="alert">
                {reason}
              </Notice>
            )}
            {data.status === "accepted" && data.emailMatches ? (
              <>
                <Notice tone="info">すでにこのワークスペースに参加しています。</Notice>
                <Button size="lg" disabled={joining} onClick={() => void join()}>
                  {joining ? "開いています…" : "ワークスペースを開く"}
                </Button>
              </>
            ) : data.status !== "pending" ? (
              <Notice tone="error" role="alert">
                {unusable[data.status as keyof typeof unusable]}
                <span className="sr-only">（{INVITATION_STATUS_LABEL[data.status]}）</span>
              </Notice>
            ) : !data.emailMatches ? (
              <>
                <Notice tone="error" role="alert">
                  この招待は、現在ログイン中のアカウント（{userEmail}
                  ）宛ではありません。招待先のメールアドレスのGoogleアカウントでログインし直してください。
                </Notice>
                {switchFailed && (
                  <Notice tone="error" role="alert">
                    ログアウトできませんでした。もう一度お試しください。
                  </Notice>
                )}
                <Button size="lg" disabled={switching} onClick={() => void switchAccount()}>
                  別のアカウントでログイン
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" disabled={joining} onClick={() => void join()}>
                  {joining ? "参加しています…" : reason ? "もう一度参加する" : "参加する"}
                </Button>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
