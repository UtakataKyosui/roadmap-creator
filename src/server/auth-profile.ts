import { eq } from "drizzle-orm";
import { authUsers, users } from "../../db/schema";
import type { Db } from "./db";

// 認証ユーザーと同じIDのプロフィールだけを復旧する。メールだけで別ユーザーに結びつけない。
// 初回の作成hookがDB障害で失敗しても、次のログイン・セッション利用で再試行できる。
export const ensureAuthProfile = async (db: Db, userId: string) => {
  const [profile] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (profile) return;

  const [user] = await db.select().from(authUsers).where(eq(authUsers.id, userId));
  if (!user) throw new Error("Authenticated user not found");
  await db
    .insert(users)
    .values({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.image,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })
    .onConflictDoNothing({ target: users.id });
};
