import { and, eq } from "drizzle-orm";
import { memberships, projects, roadmaps, workspaces } from "../../db/schema";
import type { Db } from "./db";
import { forbidden, notFound } from "./errors";
import { isUuid } from "./ids";

// パスのIDがUUIDでなければ、該当する対象は存在し得ないので404にする。
export const assertIds = (...ids: string[]) => {
  if (!ids.every(isUuid)) throw notFound();
};

// Workspaceが存在しなければ404、存在してもメンバーでなければ403。
export const requireMember = async (db: Db, workspaceId: string, userId: string) => {
  const [row] = await db
    .select({ role: memberships.role })
    .from(workspaces)
    .leftJoin(
      memberships,
      and(eq(memberships.workspaceId, workspaces.id), eq(memberships.userId, userId)),
    )
    .where(eq(workspaces.id, workspaceId));
  if (!row) throw notFound();
  if (!row.role) throw forbidden();
  return row.role;
};

export const requireProject = async (db: Db, workspaceId: string, projectId: string) => {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));
  if (!row) throw notFound();
};

export const findRoadmap = async (db: Db, workspaceId: string, roadmapId: string) => {
  const [row] = await db
    .select()
    .from(roadmaps)
    .where(and(eq(roadmaps.id, roadmapId), eq(roadmaps.workspaceId, workspaceId)));
  return row;
};
