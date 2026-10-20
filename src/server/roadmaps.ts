import { and, asc, eq, sql } from "drizzle-orm";
import { roadmaps } from "../../db/schema";
import { CreateRoadmapBody, UpdateRoadmapBody } from "@/api/generated/zod/roadmaps/roadmaps.zod";
import { assertIds, findRoadmap, requireMember, requireProject } from "./access";
import type { Db } from "./db";
import { notFound, parseInput, validationFailed, versionConflict } from "./errors";
import { nowIso, uuidv7 } from "./ids";

// OpenAPIのminLengthは空白のみの名称を許すため、サーバー側でも空白のみを拒否し、前後の空白を除く。
const trimmedName = (name: string) => {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw validationFailed([{ path: "/name", message: "名称を入力してください" }]);
  }
  return trimmed;
};

export const listRoadmaps = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
) => {
  assertIds(workspaceId, projectId);
  await requireMember(db, workspaceId, actorId);
  await requireProject(db, workspaceId, projectId);
  return db
    .select()
    .from(roadmaps)
    .where(and(eq(roadmaps.workspaceId, workspaceId), eq(roadmaps.projectId, projectId)))
    .orderBy(asc(roadmaps.createdAt), asc(roadmaps.id));
};

export const createRoadmap = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
  body: unknown,
) => {
  assertIds(workspaceId, projectId);
  await requireMember(db, workspaceId, actorId);
  await requireProject(db, workspaceId, projectId);
  const input = parseInput(CreateRoadmapBody, body);
  const now = nowIso();
  const [created] = await db
    .insert(roadmaps)
    .values({
      id: uuidv7(),
      projectId,
      workspaceId,
      name: trimmedName(input.name),
      description: input.description ?? null,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created;
};

export const getRoadmap = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  roadmapId: string,
) => {
  assertIds(workspaceId, roadmapId);
  await requireMember(db, workspaceId, actorId);
  const roadmap = await findRoadmap(db, workspaceId, roadmapId);
  if (!roadmap) throw notFound();
  return roadmap;
};

export const updateRoadmap = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  roadmapId: string,
  body: unknown,
) => {
  assertIds(workspaceId, roadmapId);
  await requireMember(db, workspaceId, actorId);
  const input = parseInput(UpdateRoadmapBody, body);

  // versionの照合と更新を1文で行い、他のユーザーの更新を上書きしない。
  const [updated] = await db
    .update(roadmaps)
    .set({
      ...(input.name !== undefined && { name: trimmedName(input.name) }),
      ...(input.description !== undefined && { description: input.description }),
      updatedAt: nowIso(),
      version: sql`${roadmaps.version} + 1`,
    })
    .where(
      and(
        eq(roadmaps.id, roadmapId),
        eq(roadmaps.workspaceId, workspaceId),
        eq(roadmaps.version, input.version),
      ),
    )
    .returning();
  if (updated) return updated;

  if (!(await findRoadmap(db, workspaceId, roadmapId))) throw notFound();
  throw versionConflict();
};
