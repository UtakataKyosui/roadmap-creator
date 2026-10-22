import type { SQLiteSelect } from "drizzle-orm/sqlite-core";
import { type SQL, and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { memberships, projects, roadmaps, tasks, users, workspaces } from "../../db/schema";
import { ListMyTasksQueryParams } from "@roadmapper/api-contract/zod/my-tasks/my-tasks.zod";
import { addDays } from "@roadmapper/domain/calendar-date";
import type { Db } from "./db";
import { parseInput } from "./errors";
import { taskColumns } from "./tasks";

const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

const orderFor = (sort: string, direction: "asc" | "desc") => {
  const dir = direction === "desc" ? desc : asc;
  switch (sort) {
    case "priority":
      return [
        dir(
          sql`case ${tasks.priority} when 'low' then 0 when 'medium' then 1 when 'high' then 2 else 3 end`,
        ),
        sql`${tasks.dueDate} is null`,
        asc(tasks.dueDate),
        asc(tasks.id),
      ];
    case "createdAt":
      return [dir(tasks.createdAt), asc(tasks.id)];
    case "updatedAt":
      return [dir(tasks.updatedAt), asc(tasks.id)];
    default:
      return [sql`${tasks.dueDate} is null`, dir(tasks.dueDate), asc(tasks.id)];
  }
};

// 期限の絞り込み条件。overdueとthisWeekは完了タスクを含めない。
const dueCondition = (filter: "overdue" | "today" | "thisWeek" | "noDueDate", today: string) => {
  switch (filter) {
    case "overdue":
      return and(sql`${tasks.dueDate} < ${today}`, ne(tasks.status, "done"));
    case "today":
      return eq(tasks.dueDate, today);
    case "thisWeek":
      return and(
        sql`${tasks.dueDate} >= ${today}`,
        sql`${tasks.dueDate} <= ${addDays(today, 6)}`,
        ne(tasks.status, "done"),
      );
    default:
      return isNull(tasks.dueDate);
  }
};

// ログイン中のユーザーが担当し、所属しているWorkspaceの、アーカイブされていないタスク。
const scopeOf = (actorId: string) =>
  and(
    eq(tasks.assigneeId, actorId),
    eq(memberships.userId, actorId),
    isNull(roadmaps.archivedAt),
    isNull(projects.archivedAt),
  )!;

// 担当タスクに、所属情報（Roadmap・Project・Workspace）と担当者（ログイン中のユーザー）を結びつける。
// Membershipを結合するため、所属を失ったWorkspaceのタスクは含まれない。
const withScope = <T extends SQLiteSelect>(query: T) =>
  query
    .innerJoin(
      roadmaps,
      and(eq(roadmaps.id, tasks.roadmapId), eq(roadmaps.workspaceId, tasks.workspaceId)),
    )
    .innerJoin(
      projects,
      and(eq(projects.id, roadmaps.projectId), eq(projects.workspaceId, roadmaps.workspaceId)),
    )
    .innerJoin(workspaces, eq(workspaces.id, tasks.workspaceId))
    .innerJoin(
      memberships,
      and(eq(memberships.workspaceId, tasks.workspaceId), eq(memberships.userId, tasks.assigneeId)),
    )
    .innerJoin(users, eq(users.id, memberships.userId));

export const listMyTasks = async (db: Db, actorId: string, search: URLSearchParams) => {
  const query = parseInput(ListMyTasksQueryParams, {
    today: search.get("today") ?? undefined,
    q: search.get("q") ?? undefined,
    status: search.has("status") ? search.getAll("status") : undefined,
    due: search.has("due") ? search.getAll("due") : undefined,
    sort: search.get("sort") ?? undefined,
    direction: search.get("direction") ?? undefined,
    page: search.has("page") ? Number(search.get("page")) : undefined,
    pageSize: search.has("pageSize") ? Number(search.get("pageSize")) : undefined,
  });

  const scope = scopeOf(actorId);
  const conditions: SQL[] = [scope];
  const statuses = query.status && [...new Set(query.status)];
  if (statuses?.length) conditions.push(inArray(tasks.status, statuses));
  const dues = query.due && [...new Set(query.due)];
  if (dues?.length) {
    conditions.push(or(...dues.map((due) => dueCondition(due, query.today)))!);
  }
  if (query.q) {
    const pattern = likePattern(query.q);
    conditions.push(
      sql`(${tasks.title} like ${pattern} escape '\\' or ${tasks.description} like ${pattern} escape '\\')`,
    );
  }
  const where = and(...conditions);

  const [rows, [filtered], [summary]] = await Promise.all([
    withScope(
      db
        .select({
          task: taskColumns,
          assignee: {
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
          workspaceName: workspaces.name,
          projectId: projects.id,
          projectName: projects.name,
          roadmapName: roadmaps.name,
        })
        .from(tasks)
        .$dynamic(),
    )
      .where(where)
      .orderBy(...orderFor(query.sort, query.direction))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    withScope(
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(tasks)
        .$dynamic(),
    ).where(where),
    withScope(
      db
        .select({
          total: sql<number>`count(*)`.mapWith(Number),
          todo: sql<number>`coalesce(sum(${tasks.status} = 'todo'), 0)`.mapWith(Number),
          inProgress: sql<number>`coalesce(sum(${tasks.status} = 'in_progress'), 0)`.mapWith(
            Number,
          ),
          review: sql<number>`coalesce(sum(${tasks.status} = 'review'), 0)`.mapWith(Number),
          done: sql<number>`coalesce(sum(${tasks.status} = 'done'), 0)`.mapWith(Number),
          overdue:
            sql<number>`coalesce(sum(${tasks.dueDate} < ${query.today} and ${tasks.status} != 'done'), 0)`.mapWith(
              Number,
            ),
          dueThisWeek:
            sql<number>`coalesce(sum(${tasks.dueDate} >= ${query.today} and ${tasks.dueDate} <= ${addDays(query.today, 6)} and ${tasks.status} != 'done'), 0)`.mapWith(
              Number,
            ),
        })
        .from(tasks)
        .$dynamic(),
    ).where(scope),
  ]);

  return {
    items: rows,
    page: query.page,
    pageSize: query.pageSize,
    totalCount: filtered.count,
    summary,
  };
};
