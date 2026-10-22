import { and, desc, eq, sql } from "drizzle-orm";
import { invitations, memberships, users, workspaces } from "../../db/schema";
import { CreateInvitationBody } from "@/api/generated/zod/invitations/invitations.zod";
import { assertIds, requireMember } from "./access";
import type { Db } from "./db";
import { forbidden, notFound, parseInput, validationFailed } from "./errors";
import { nowIso, uuidv7 } from "./ids";
import { logMailer, type Mailer } from "./mailer";

export const INVITATION_EXPIRY_DAYS = 7;

type Deps = { mailer?: Mailer; now?: Date };
type InvitationRow = typeof invitations.$inferSelect;
type Status = "pending" | "accepted" | "revoked" | "expired";

const statusOf = (row: InvitationRow, now: Date): Status => {
  if (row.acceptedAt) return "accepted";
  if (row.revokedAt) return "revoked";
  return row.expiresAt <= now.toISOString() ? "expired" : "pending";
};

const toInvitation = (row: InvitationRow, now: Date) => ({
  id: row.id,
  workspaceId: row.workspaceId,
  email: row.email,
  role: row.role,
  status: statusOf(row, now),
  expiresAt: row.expiresAt,
  invitedBy: row.invitedBy,
  createdAt: row.createdAt,
  acceptedAt: row.acceptedAt,
});

const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

const inviteUrlFor = (token: string) => `/invitations/${token}`;
const expiryFrom = (now: Date) =>
  new Date(now.getTime() + INVITATION_EXPIRY_DAYS * 86_400_000).toISOString();

const reason = (path: string, message: string) => validationFailed([{ path, message }]);

// 招待の管理はowner/adminだけが行える。
const requireManager = async (db: Db, workspaceId: string, actorId: string) => {
  const role = await requireMember(db, workspaceId, actorId);
  if (role === "member") throw forbidden();
};

const findInvitation = async (db: Db, workspaceId: string, invitationId: string) => {
  const [row] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.workspaceId, workspaceId)));
  if (!row) throw notFound();
  return row;
};

const sendMail = async (
  db: Db,
  mailer: Mailer,
  actorId: string,
  workspaceId: string,
  email: string,
  token: string,
) => {
  const [workspace] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, actorId));
  try {
    const sent = await mailer.sendInvitation({
      to: email,
      workspaceName: workspace?.name ?? "",
      invitedByName: inviter?.name ?? "",
      invitePath: inviteUrlFor(token),
    });
    return sent !== false;
  } catch (error) {
    // 送信に失敗しても招待は有効。inviteUrlを共有して受諾できる。
    console.error("Failed to send invitation mail", error);
    return false;
  }
};

export const listInvitations = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  { now = new Date() }: Deps = {},
) => {
  assertIds(workspaceId);
  await requireManager(db, workspaceId, actorId);
  const rows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.workspaceId, workspaceId))
    .orderBy(desc(invitations.createdAt), desc(invitations.id));
  return rows.map((row) => toInvitation(row, now));
};

export const createInvitation = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  body: unknown,
  { mailer = logMailer, now = new Date() }: Deps = {},
) => {
  assertIds(workspaceId);
  await requireManager(db, workspaceId, actorId);
  // 前後の空白は、検証の前に取り除く。
  const trimmed =
    typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
      ? { ...body, email: body.email.trim() }
      : body;
  const input = parseInput(CreateInvitationBody, trimmed);
  const email = input.email.toLowerCase();

  const [member] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, workspaceId), sql`lower(${users.email}) = ${email}`));
  if (member) throw reason("/email", "このメールアドレスのユーザーは既にメンバーです");

  const [pending] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.workspaceId, workspaceId),
        eq(invitations.email, email),
        sql`${invitations.acceptedAt} is null and ${invitations.revokedAt} is null`,
      ),
    );
  if (pending && statusOf(pending, now) === "pending") {
    throw reason("/email", "既に招待中です。再送する場合は一覧から再送してください");
  }

  const token = newToken();
  const timestamp = nowIso();
  const row = {
    id: uuidv7(),
    workspaceId,
    email,
    role: input.role ?? ("member" as const),
    tokenHash: await hashToken(token),
    invitedBy: actorId,
    expiresAt: expiryFrom(now),
    acceptedAt: null,
    acceptedBy: null,
    revokedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  try {
    // 期限切れの招待が残っていれば取り消し、新しい招待に置き換える。
    await db.batch([
      db
        .update(invitations)
        .set({ revokedAt: timestamp, updatedAt: timestamp })
        .where(
          and(
            pending ? eq(invitations.id, pending.id) : sql`0`,
            sql`${invitations.expiresAt} <= ${now.toISOString()}`,
            sql`${invitations.acceptedAt} is null and ${invitations.revokedAt} is null`,
          ),
        ),
      db.insert(invitations).values(row),
    ]);
  } catch (error) {
    // 同時に同じメールアドレスへ招待された場合は、部分一意インデックスが拒否する。
    if (String(error).includes("UNIQUE")) {
      throw reason("/email", "既に招待中です。再送する場合は一覧から再送してください");
    }
    throw error;
  }

  const emailSent = await sendMail(db, mailer, actorId, workspaceId, email, token);
  return { invitation: toInvitation(row, now), inviteUrl: inviteUrlFor(token), emailSent };
};

export const resendInvitation = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  invitationId: string,
  { mailer = logMailer, now = new Date() }: Deps = {},
) => {
  assertIds(workspaceId, invitationId);
  await requireManager(db, workspaceId, actorId);
  const row = await findInvitation(db, workspaceId, invitationId);
  const status = statusOf(row, now);
  if (status === "accepted") throw reason("", "既に受諾されている招待は再送できません");
  if (status === "revoked") throw reason("", "取り消された招待は再送できません");

  const token = newToken();
  const updated = {
    tokenHash: await hashToken(token),
    expiresAt: expiryFrom(now),
    updatedAt: nowIso(),
  };
  await db.update(invitations).set(updated).where(eq(invitations.id, row.id));

  const emailSent = await sendMail(db, mailer, actorId, workspaceId, row.email, token);
  return {
    invitation: toInvitation({ ...row, ...updated }, now),
    inviteUrl: inviteUrlFor(token),
    emailSent,
  };
};

export const revokeInvitation = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  invitationId: string,
  { now = new Date() }: Deps = {},
) => {
  assertIds(workspaceId, invitationId);
  await requireManager(db, workspaceId, actorId);
  const row = await findInvitation(db, workspaceId, invitationId);
  const status = statusOf(row, now);
  if (status === "revoked") return;
  if (status === "accepted") throw reason("", "受諾済みの招待は取り消せません");
  if (status === "expired") throw reason("", "有効期限が切れた招待は取り消せません");
  const timestamp = nowIso();
  await db
    .update(invitations)
    .set({ revokedAt: timestamp, updatedAt: timestamp })
    .where(eq(invitations.id, row.id));
};

const findByToken = async (db: Db, token: string) => {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, await hashToken(token)));
  if (!row) throw notFound();
  return row;
};

const actorEmail = async (db: Db, actorId: string) => {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, actorId));
  return user?.email.toLowerCase();
};

export const getInvitationPreview = async (
  db: Db,
  actorId: string,
  token: string,
  { now = new Date() }: Deps = {},
) => {
  const row = await findByToken(db, token);
  const [workspace] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, row.workspaceId));
  return {
    workspaceName: workspace?.name ?? "",
    status: statusOf(row, now),
    expiresAt: row.expiresAt,
    emailMatches: (await actorEmail(db, actorId)) === row.email,
  };
};

export const acceptInvitation = async (
  db: Db,
  actorId: string,
  token: string,
  { now = new Date() }: Deps = {},
) => {
  const row = await findByToken(db, token);
  const status = statusOf(row, now);

  // 招待先本人であることを、受諾済みの再受諾も含めて確認する。
  if ((await actorEmail(db, actorId)) !== row.email) throw forbidden();

  if (status === "accepted") {
    if (row.acceptedBy === actorId) return { workspaceId: row.workspaceId, alreadyMember: true };
    throw reason("", "この招待は既に使われています");
  }
  if (status === "revoked") throw reason("", "この招待は取り消されました");
  if (status === "expired") throw reason("", "この招待は有効期限が切れています");

  const timestamp = nowIso();
  // batch内の両文で同じ有効性を検証する。取消・再送された招待ではMembershipも作らない。
  const claimable = and(
    eq(invitations.id, row.id),
    eq(invitations.tokenHash, row.tokenHash),
    sql`${invitations.acceptedAt} is null and ${invitations.revokedAt} is null`,
    sql`${invitations.expiresAt} > ${now.toISOString()}`,
  );
  const [, claimed] = await db.batch([
    db
      .insert(memberships)
      .select(
        db
          .select({
            id: sql<string>`${uuidv7()}`.as("id"),
            workspaceId: invitations.workspaceId,
            userId: sql<string>`${actorId}`.as("user_id"),
            role: invitations.role,
            createdAt: sql<string>`${timestamp}`.as("created_at"),
            updatedAt: sql<string>`${timestamp}`.as("updated_at"),
          })
          .from(invitations)
          .where(claimable),
      )
      .onConflictDoNothing(),
    db
      .update(invitations)
      .set({ acceptedAt: timestamp, acceptedBy: actorId, updatedAt: timestamp })
      .where(claimable)
      .returning({ id: invitations.id }),
  ]);
  if (!claimed.length) {
    const current = await findByToken(db, token);
    if (current.acceptedBy === actorId) {
      return { workspaceId: row.workspaceId, alreadyMember: true };
    }
    throw reason("", "招待が更新または取り消されました。招待URLを確認してください");
  }
  return { workspaceId: row.workspaceId, alreadyMember: false };
};
