import { Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorState } from "@/components/state/StateViews";
import { buttonVariants } from "@/components/ui/button";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  console.error("DefaultCatchBoundary Error:", error);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-app p-6">
      <ErrorState error={error} onRetry={() => router.invalidate()} />
      <Link to="/" className={buttonVariants({ variant: "ghost" })}>
        トップへ戻る
      </Link>
    </div>
  );
}
