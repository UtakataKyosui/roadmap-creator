import { createFileRoute, redirect } from "@tanstack/react-router";
import { Map as MapIcon } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/api/auth-client";
import { Notice } from "@/components/state/StateViews";
import { Button } from "@roadmapper/ui/components/ui/button";
import { loginErrorMessage, loginUrl, safeRedirect } from "@roadmapper/domain/auth-redirect";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; error?: string } => ({
    ...(typeof search.redirect === "string" && { redirect: search.redirect }),
    ...(typeof search.error === "string" && { error: search.error }),
  }),
  // ログイン済みなら戻り先へ進む。
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ href: safeRedirect(search.redirect) });
  },
  head: () => ({ meta: [{ title: "ログイン | Roadmap Studio" }] }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const target = safeRedirect(search.redirect);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string>();
  const message = failure ?? loginErrorMessage(search.error);

  const continueWithGoogle = async () => {
    setPending(true);
    setFailure(undefined);
    try {
      // 成功すると、このページから Google の認証画面へ遷移する。
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: target,
        errorCallbackURL: loginUrl(target),
      });
      if (result.error) {
        setFailure(loginErrorMessage("unknown"));
        setPending(false);
      }
    } catch {
      setFailure(loginErrorMessage("network"));
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-subtle p-6">
      <section className="flex w-full max-w-sm flex-col gap-5 rounded-lg border bg-surface p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-[8px] bg-indigo text-white">
            <MapIcon aria-hidden className="size-5" />
          </span>
          <span className="text-lg font-semibold">Roadmap Studio</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-bold">登録・ログイン</h1>
          <p className="text-xs leading-normal text-subtle-foreground">
            Googleアカウントで登録・ログインします。初めての方はアカウントが自動で作成されます。
          </p>
        </div>
        {message && (
          <Notice tone="error" role="alert">
            {message}
          </Notice>
        )}
        <Button size="lg" disabled={pending} onClick={continueWithGoogle}>
          {pending ? "Googleへ移動しています…" : message ? "もう一度Googleで続行" : "Googleで続行"}
        </Button>
      </section>
    </main>
  );
}
