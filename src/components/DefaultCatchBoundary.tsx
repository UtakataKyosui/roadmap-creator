import { Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorState } from "@/components/state/StateViews";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  console.error("DefaultCatchBoundary Error:", error);

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 p-4">
      <ErrorState error={error} onRetry={() => router.invalidate()} />
      <Link to="/" className="text-sm underline">
        トップへ戻る
      </Link>
    </div>
  );
}
