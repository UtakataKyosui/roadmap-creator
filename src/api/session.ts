import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { resolveActorId } from "@/server/auth";
import { database } from "@/server/database";
import { HttpError } from "@/server/errors";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

// サーバーでセッションを検証して、ログイン中の利用者を返す。未ログインならnull。
export const getSessionUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    try {
      const actorId = await resolveActorId();
      const [user] = await database
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, actorId));
      return user ?? null;
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) return null;
      throw error;
    }
  },
);

export const sessionQueryKey = ["session"] as const;

export const sessionQueryOptions = () => ({
  queryKey: sessionQueryKey,
  queryFn: () => getSessionUser(),
});
