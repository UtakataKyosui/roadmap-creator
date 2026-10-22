import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";
import { authAccounts, authUsers, users } from "../../db/schema";
import { devFixtures } from "../../db/dev-fixtures";
import { createAuth } from "./better-auth";
import { ensureAuthProfile } from "./auth-profile";
import { isUuid } from "./ids";
import { createTestDb } from "./testing/test-db";

const setup = (db = createTestDb().db) => {
  const auth = createAuth(db, {
    baseURL: "http://localhost:3000",
    secret: "test-secret-test-secret-test-secret",
    google: { clientId: "id", clientSecret: "secret" },
  });
  return { db, auth };
};

const googleUser = (email: string, name = "Taro") => ({
  user: { email, name, emailVerified: true, image: "https://example.com/a.png" },
  account: { providerId: "google", accountId: `google-${email}`, scope: "openid" },
});

const createGoogleUser = async (auth: ReturnType<typeof createAuth>, email: string) => {
  const { internalAdapter } = await auth.$context;
  const { user, account } = googleUser(email);
  return internalAdapter.createOAuthUser(user, account);
};

describe("Better Auth", () => {
  it("プロフィール作成の一時的な失敗は次のセッション作成で復旧する", async () => {
    const options: { failOn?: RegExp } = { failOn: /insert into "users"/ };
    const { db } = createTestDb(options);
    const { auth } = setup(db);
    await expect(createGoogleUser(auth, "taro@example.com")).rejects.toThrow();
    const [identity] = await db.select().from(authUsers);
    expect(identity).toBeDefined();
    expect(await db.select().from(authAccounts)).toHaveLength(1);
    expect(await db.select().from(users)).toHaveLength(0);

    options.failOn = undefined;
    const { internalAdapter } = await auth.$context;
    expect(await internalAdapter.createSession(identity.id)).toBeTruthy();
    expect(await db.select().from(users)).toMatchObject([
      { id: identity.id, email: identity.email },
    ]);
    await ensureAuthProfile(db, identity.id);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("既存セッションのプロフィールも同じ認証IDで復旧できる", async () => {
    const { db, auth } = setup();
    const { user } = await createGoogleUser(auth, "taro@example.com");
    await db.delete(users).where(eq(users.id, user.id));
    await Promise.all([ensureAuthProfile(db, user.id), ensureAuthProfile(db, user.id)]);
    expect(await db.select().from(users)).toMatchObject([{ id: user.id, name: "Taro" }]);
  });

  it("プロフィール復旧でもメールが同じ別IDの利用者には結びつけない", async () => {
    const { db, auth } = setup();
    const { user } = await createGoogleUser(auth, "taro@example.com");
    await db.delete(users).where(eq(users.id, user.id));
    await db.insert(users).values({
      id: devFixtures.userId,
      name: "別ユーザー",
      email: user.email,
      createdAt: "t",
      updatedAt: "t",
    });
    await expect(ensureAuthProfile(db, user.id)).rejects.toThrow();
    expect(await db.select().from(users)).toMatchObject([{ id: devFixtures.userId }]);
  });

  it("初回のGoogle認証で、UUIDの認証ユーザーとアプリのユーザーを同じIDで作る", async () => {
    const { db, auth } = setup();
    const created = await createGoogleUser(auth, "taro@example.com");

    expect(isUuid(created.user.id)).toBe(true);
    const [profile] = await db.select().from(users).where(eq(users.id, created.user.id));
    expect(profile).toMatchObject({
      email: "taro@example.com",
      name: "Taro",
      avatarUrl: "https://example.com/a.png",
    });
  });

  it("同じGoogle主体のアカウントは重複して作れない", async () => {
    const { db, auth } = setup();
    const first = await createGoogleUser(auth, "taro@example.com");
    const { internalAdapter } = await auth.$context;

    await expect(
      internalAdapter.createAccount({
        userId: first.user.id,
        providerId: "google",
        accountId: "google-taro@example.com",
      }),
    ).rejects.toThrow();
    expect(await db.select().from(authAccounts)).toHaveLength(1);
  });

  it("メールアドレスが既存のアプリユーザーと同じでも、自動で統合せず作成を拒否する", async () => {
    const { db, auth } = setup();
    await db.insert(users).values({
      id: devFixtures.userId,
      name: "既存",
      email: "taro@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(createGoogleUser(auth, "taro@example.com")).rejects.toThrow();
    expect(await db.select().from(authUsers)).toHaveLength(0);
    expect(await db.select().from(users)).toHaveLength(1);
  });
});
