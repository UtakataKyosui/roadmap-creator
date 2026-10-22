import { and, asc, eq, exists, sql } from "drizzle-orm";
import { labels, memberships, projects, users, workspaces } from "../../db/schema";
import { assertIds, requireMember, requireProject } from "./access";
import type { Db } from "./db";
import {
  CreateWorkspaceBody,
  UpdateWorkspaceBody,
} from "@/api/generated/zod/workspaces/workspaces.zod";
import { UpdateProjectBody } from "@/api/generated/zod/projects/projects.zod";
import { forbidden, notFound, parseInput, validationFailed, versionConflict } from "./errors";
import { nowIso, uuidv7 } from "./ids";

const requireManager = async (db: Db, workspaceId: string, actorId: string) => {
  if ((await requireMember(db, workspaceId, actorId)) === "member") throw forbidden();
};

const trimmedName = (value: string) => {
  const name = value.trim();
  if (!name) throw validationFailed([{ path: "/name", message: "名称を入力してください" }]);
  return name;
};

export const updateWorkspace = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  body: unknown,
) => {
  assertIds(workspaceId);
  await requireManager(db, workspaceId, actorId);
  const input = parseInput(UpdateWorkspaceBody, body);
  const [updated] = await db
    .update(workspaces)
    .set({
      name: trimmedName(input.name),
      updatedAt: nowIso(),
      version: sql`${workspaces.version} + 1`,
    })
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.version, input.version)))
    .returning();
  if (updated) return updated;
  const [current] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  if (!current) throw notFound();
  throw versionConflict();
};

export const updateProject = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
  body: unknown,
) => {
  assertIds(workspaceId, projectId);
  await requireManager(db, workspaceId, actorId);
  await requireProject(db, workspaceId, projectId);
  const input = parseInput(UpdateProjectBody, body);
  const [updated] = await db
    .update(projects)
    .set({
      name: trimmedName(input.name),
      updatedAt: nowIso(),
      version: sql`${projects.version} + 1`,
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        eq(projects.version, input.version),
      ),
    )
    .returning();
  if (updated) return updated;
  await requireProject(db, workspaceId, projectId);
  throw versionConflict();
};

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

export const deleteWorkspace = async (db: Db, actorId: string, workspaceId: string) => {
  assertIds(workspaceId);
  if ((await requireMember(db, workspaceId, actorId)) !== "owner") throw forbidden();
  const [deleted] = await db
    .delete(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        exists(
          db
            .select({ id: memberships.id })
            .from(memberships)
            .where(
              and(
                eq(memberships.workspaceId, workspaceId),
                eq(memberships.userId, actorId),
                eq(memberships.role, "owner"),
              ),
            ),
        ),
      ),
    )
    .returning({ id: workspaces.id });
  if (!deleted) throw forbidden();
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
