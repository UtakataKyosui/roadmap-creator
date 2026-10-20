import { asc, eq } from "drizzle-orm";
import { labels, memberships, projects, users, workspaces } from "../../db/schema";
import { assertIds, requireMember } from "./access";
import type { Db } from "./db";

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
