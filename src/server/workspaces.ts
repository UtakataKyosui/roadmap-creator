import { asc, eq } from "drizzle-orm";
import { labels, memberships, projects, users, workspaces } from "../../db/schema";
import { assertIds, requireMember } from "./access";
import type { Db } from "./db";
import { CreateWorkspaceBody } from "@/api/generated/zod/workspaces/workspaces.zod";
import { parseInput, validationFailed } from "./errors";
import { nowIso, uuidv7 } from "./ids";

export const createWorkspace = async (db: Db, actorId: string, body: unknown) => {
  const input = parseInput(CreateWorkspaceBody, body);
  const name = input.name.trim();
  if (!name) {
    throw validationFailed([{ path: "/name", message: "ワークスペース名を入力してください" }]);
  }
  const workspaceId = uuidv7();
  const now = nowIso();
  // D1のbatchはトランザクションとして実行される。所有者や初期プロジェクトのない状態を残さない。
  const [created] = await db.batch([
    db
      .insert(workspaces)
      .values({ id: workspaceId, name, createdAt: now, updatedAt: now })
      .returning(),
    db.insert(memberships).values({
      id: uuidv7(),
      workspaceId,
      userId: actorId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(projects).values({
      id: uuidv7(),
      workspaceId,
      name: "マイプロジェクト",
      createdAt: now,
      updatedAt: now,
    }),
  ]);
  return created[0];
};

export const listWorkspaces = (db: Db, actorId: string) =>
  db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      version: workspaces.version,
    })
    .from(workspaces)
    .innerJoin(memberships, eq(memberships.workspaceId, workspaces.id))
    .where(eq(memberships.userId, actorId))
    .orderBy(asc(workspaces.name), asc(workspaces.id));

export const listWorkspaceMembers = async (db: Db, actorId: string, workspaceId: string) => {
  assertIds(workspaceId);
  await requireMember(db, workspaceId, actorId);
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(asc(users.name), asc(users.id));
  return rows.map(({ role, ...user }) => ({ user, role }));
};

export const listLabels = async (db: Db, actorId: string, workspaceId: string) => {
  assertIds(workspaceId);
  await requireMember(db, workspaceId, actorId);
  return db
    .select()
    .from(labels)
    .where(eq(labels.workspaceId, workspaceId))
    .orderBy(asc(labels.name), asc(labels.id));
};

export const listProjects = async (db: Db, actorId: string, workspaceId: string) => {
  assertIds(workspaceId);
  await requireMember(db, workspaceId, actorId);
  return db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.createdAt), asc(projects.id));
};
