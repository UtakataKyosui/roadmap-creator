import type { User } from "@/api/generated/models";
import { cn } from "@/lib/utils";

// 担当者が未設定のときはuserを渡さない。名前の頭文字（または画像）を丸く表示する。
export function Avatar({
  user,
  className,
}: {
  user?: Pick<User, "name" | "avatarUrl">;
  className?: string;
}) {
  const base = "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs";
  if (!user) {
    return (
      <span
        role="img"
        aria-label="担当者未設定"
        className={cn(base, "border border-dashed text-muted-foreground", className)}
      />
    );
  }
  if (user.avatarUrl) {
    return (
      <img src={user.avatarUrl} alt={user.name} className={cn(base, "object-cover", className)} />
    );
  }
  return (
    <span
      role="img"
      aria-label={user.name}
      className={cn(base, "bg-secondary font-medium", className)}
    >
      {Array.from(user.name)[0]}
    </span>
  );
}
