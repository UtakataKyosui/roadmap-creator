import {
  type SQL,
  and,
  asc,
  desc,
  count,
  eq,
  getTableColumns,
  inArray,
  max,
  min,
  ne,
  sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { generateKeyBetween } from "fractional-indexing";
import { comments, labels, memberships, taskLabels, tasks } from "../../db/schema";
import { ListTasksQueryParams } from "@roadmapper/api-contract/zod/tasks/tasks.zod";
import { CreateTaskInput, updateTaskInputFor } from "@roadmapper/domain/validation";
import { assertIds, findRoadmap, requireMember } from "./access";
import type { Db } from "./db";
import { notFound, parseInput, toPointer, validationFailed, versionConflict } from "./errors";
import { nowIso, uuidv7 } from "./ids";

// D1は1文あたりの束縛パラメータが100個までなので、IN句に渡す件数を抑える。
const MAX_LABELS = 50;

// 単一テーブルのselectではDrizzleが列名の修飾を外すため、サブクエリ内の外側の列は修飾付きで書く。
const outerTaskId = sql.raw('"tasks"."id"');

export const taskColumns = {
  ...getTableColumns(tasks),
  labelIds:
    sql<string>`(select coalesce(json_group_array(label_id), '[]') from (select ${taskLabels.labelId} as label_id from ${taskLabels} where ${taskLabels.taskId} = ${outerTaskId} order by ${taskLabels.labelId}))`.mapWith(
      (value: string) => JSON.parse(value) as string[],
    ),
  commentCount:
    sql<number>`(select count(*) from ${comments} where ${comments.taskId} = ${outerTaskId})`.mapWith(
      Number,
    ),
};

const findTask = async (db: Db, workspaceId: string, roadmapId: string, taskId: string) => {
  const [row] = await db
    .select(taskColumns)
    .from(tasks)
    .where(
      and(eq(tasks.id, taskId), eq(tasks.roadmapId, roadmapId), eq(tasks.workspaceId, workspaceId)),
    );
  return row;
};

const requireRoadmap = async (db: Db, workspaceId: string, roadmapId: string) => {
  if (!(await findRoadmap(db, workspaceId, roadmapId))) throw notFound();
};

const decodeCursor = (cursor: string | undefined) => {
  if (cursor === undefined) return 0;
  try {
    const { offset } = JSON.parse(atob(cursor.replaceAll("-", "+").replaceAll("_", "/")));
    if (Number.isInteger(offset) && offset >= 0) return offset as number;
  } catch {
    // 下で検証エラーにする。
  }
  throw validationFailed([{ path: "/cursor", message: "cursorが不正です" }]);
};

const encodeCursor = (offset: number) =>
  btoa(JSON.stringify({ offset })).replaceAll("+", "-").replaceAll("/", "_");

const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

const orderFor = (sort: string, direction: "asc" | "desc") => {
  const dir = direction === "desc" ? desc : asc;
  switch (sort) {
    case "dueDate":
      return [sql`${tasks.dueDate} is null`, dir(tasks.dueDate), asc(tasks.id)];
    case "startDate":
      return [sql`${tasks.startDate} is null`, dir(tasks.startDate), asc(tasks.id)];
    case "priority":
      return [
        dir(
          sql`case ${tasks.priority} when 'low' then 0 when 'medium' then 1 when 'high' then 2 else 3 end`,
        ),
        asc(tasks.id),
      ];
    case "createdAt":
      return [dir(tasks.createdAt), asc(tasks.id)];
    default:
      return [dir(tasks.sortOrder), dir(tasks.id)];
  }
};

export const listTasks = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  roadmapId: string,
  search: URLSearchParams,
) => {
  assertIds(workspaceId, roadmapId);
  await requireMember(db, workspaceId, actorId);
  await requireRoadmap(db, workspaceId, roadmapId);

  const query = parseInput(ListTasksQueryParams, {
    status: search.has("status") ? search.getAll("status") : undefined,
    assigneeId: search.get("assigneeId") ?? undefined,
    labelId: search.has("labelId") ? search.getAll("labelId") : undefined,
    q: search.get("q") ?? undefined,
    sort: search.get("sort") ?? undefined,
    direction: search.get("direction") ?? undefined,
    limit: search.has("limit") ? Number(search.get("limit")) : undefined,
    cursor: search.get("cursor") ?? undefined,
  });
  // 値の重複を除く。IN句に渡す件数が束縛パラメータの上限を超えないようにする。
  query.status &&= [...new Set(query.status)];
  query.labelId &&= [...new Set(query.labelId)];
  if (query.labelId && query.labelId.length > MAX_LABELS) {
    throw validationFailed([
      { path: "/labelId", message: `labelIdは${MAX_LABELS}個まで指定できます` },
    ]);
  }
  const offset = decodeCursor(query.cursor);

  const conditions: SQL[] = [eq(tasks.roadmapId, roadmapId), eq(tasks.workspaceId, workspaceId)];
  if (query.status?.length) conditions.push(inArray(tasks.status, query.status));
  if (query.assigneeId) conditions.push(eq(tasks.assigneeId, query.assigneeId));
  if (query.labelId?.length) {
    conditions.push(
      sql`exists (select 1 from ${taskLabels} where ${taskLabels.taskId} = ${outerTaskId} and ${inArray(taskLabels.labelId, query.labelId)})`,
    );
  }
  if (query.q) {
    const pattern = likePattern(query.q);
    conditions.push(
      sql`(${tasks.title} like ${pattern} escape '\\' or ${tasks.description} like ${pattern} escape '\\')`,
    );
  }

  const rows = await db
    .select(taskColumns)
    .from(tasks)
    .where(and(...conditions))
    .orderBy(...orderFor(query.sort, query.direction))
    .limit(query.limit + 1)
    .offset(offset);

  const hasMore = rows.length > query.limit;
  return {
    items: hasMore ? rows.slice(0, query.limit) : rows,
    nextCursor: hasMore ? encodeCursor(offset + query.limit) : null,
  };
};

export const getTask = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  roadmapId: string,
  taskId: string,
) => {
  assertIds(workspaceId, roadmapId, taskId);
  await requireMember(db, workspaceId, actorId);
  const task = await findTask(db, workspaceId, roadmapId, taskId);
  if (!task) throw notFound();
  return task;
};

// 担当者とラベルが同じWorkspaceに属していることを確かめる。
const checkReferences = async (
  db: Db,
  workspaceId: string,
  refs: { assigneeId?: string | null; labelIds?: string[] },
) => {
  const details: { path: string; message: string }[] = [];
  if (refs.assigneeId) {
    const [member] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, refs.assigneeId)),
      );
    if (!member) {
      details.push({ path: "/assigneeId", message: "同じWorkspaceのメンバーではありません" });
    }
  }
  const labelIds = refs.labelIds ?? [];
  if (labelIds.length > MAX_LABELS) {
    details.push({ path: "/labelIds", message: `ラベルは${MAX_LABELS}個まで付けられます` });
  } else if (labelIds.length > 0) {
    const found = await db
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, labelIds)));
    const known = new Set(found.map((label) => label.id));
    labelIds.forEach((id, index) => {
      if (!known.has(id)) {
        details.push({
          path: toPointer(["labelIds", index]),
          message: "同じWorkspaceのラベルではありません",
        });
      }
    });
  }
  if (details.length > 0) throw validationFailed(details);
};

type Column = { roadmapId: string; status: string; excludeId?: string };

// 列（同一Roadmap・同一status）の中で、境界より小さい最大／大きい最小のsortOrderを返す。
const edgeKey = async (db: Db, column: Column, side: "below" | "above", bound?: string) => {
  const conditions: SQL[] = [
    eq(tasks.roadmapId, column.roadmapId),
    eq(tasks.status, column.status as (typeof tasks.status.enumValues)[number]),
  ];
  if (column.excludeId) conditions.push(ne(tasks.id, column.excludeId));
  if (bound !== undefined) {
    conditions.push(
      side === "below" ? sql`${tasks.sortOrder} < ${bound}` : sql`${tasks.sortOrder} > ${bound}`,
    );
  }
  const [row] = await db
    .select({ key: side === "below" ? max(tasks.sortOrder) : min(tasks.sortOrder) })
    .from(tasks)
    .where(and(...conditions));
  return row?.key ?? null;
};

// 列の中に、2つの境界の間（どちらも含まない）にあるタスクが残っているかを返す。nullは境界なし。
const hasSiblingBetween = async (
  db: Db,
  column: Column,
  lower: string | null,
  upper: string | null,
) => {
  const conditions: SQL[] = [
    eq(tasks.roadmapId, column.roadmapId),
    eq(tasks.status, column.status as (typeof tasks.status.enumValues)[number]),
  ];
  if (column.excludeId) conditions.push(ne(tasks.id, column.excludeId));
  if (lower !== null) conditions.push(sql`${tasks.sortOrder} > ${lower}`);
  if (upper !== null) conditions.push(sql`${tasks.sortOrder} < ${upper}`);
  const [row] = await db
    .select({ total: count() })
    .from(tasks)
    .where(and(...conditions));
  return (row?.total ?? 0) > 0;
};

const keyBetween = (lower: string | null, upper: string | null, path: string) => {
  if (lower !== null && upper !== null && lower >= upper) {
    throw validationFailed([{ path, message: "指定した位置には並べ替えできません" }]);
  }
  try {
    return generateKeyBetween(lower, upper);
  } catch {
    throw validationFailed([{ path, message: "指定した位置には並べ替えできません" }]);
  }
};

// 移動先の直前・直後のTaskから、新しいsortOrderを採番する。
// 片方が省略されたときは、列の中でもう片方に隣接するTaskを境界にする。
const sortOrderForMove = async (
  db: Db,
  current: { id: string; roadmapId: string },
  status: string,
  before: string | null | undefined,
  after: string | null | undefined,
) => {
  const column: Column = { roadmapId: current.roadmapId, status, excludeId: current.id };

  if (before === undefined && after === undefined) {
    return keyBetween(await edgeKey(db, column, "below"), null, "/status");
  }

  const loadNeighbor = async (id: string, path: string) => {
    const [row] = await db
      .select({ sortOrder: tasks.sortOrder })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, id),
          eq(tasks.roadmapId, column.roadmapId),
          eq(tasks.status, status as (typeof tasks.status.enumValues)[number]),
          ne(tasks.id, current.id),
        ),
      );
    if (!row) {
      throw validationFailed([{ path, message: "移動先の列にあるタスクを指定してください" }]);
    }
    return row.sortOrder;
  };

  const beforeKey = before ? await loadNeighbor(before, "/beforeTaskId") : null;
  const afterKey = after ? await loadNeighbor(after, "/afterTaskId") : null;

  let lower: string | null;
  let upper: string | null;
  if (before === undefined) {
    lower =
      afterKey === null
        ? await edgeKey(db, column, "below")
        : await edgeKey(db, column, "below", afterKey);
    upper = afterKey;
  } else if (after === undefined) {
    lower = beforeKey;
    upper =
      beforeKey === null
        ? await edgeKey(db, column, "above")
        : await edgeKey(db, column, "above", beforeKey);
  } else {
    lower = beforeKey;
    upper = afterKey;
    if (await hasSiblingBetween(db, column, lower, upper)) {
      throw validationFailed([
        {
          path: "/beforeTaskId",
          message: "指定した直前・直後のタスクは隣り合っていません",
        },
      ]);
    }
  }
  return keyBetween(lower, upper, "/beforeTaskId");
};

export const createTask = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  roadmapId: string,
  body: unknown,
) => {
  assertIds(workspaceId, roadmapId);
  await requireMember(db, workspaceId, actorId);
  await requireRoadmap(db, workspaceId, roadmapId);
  const input = parseInput(CreateTaskInput, body);
  const labelIds = [...new Set(input.labelIds ?? [])];
  await checkReferences(db, workspaceId, { assigneeId: input.assigneeId, labelIds });

  const id = uuidv7();
  const now = nowIso();
  const sortOrder = keyBetween(
    await edgeKey(db, { roadmapId, status: input.status }, "below"),
    null,
    "/status",
  );
  await db.batch([
    db.insert(tasks).values({
      id,
      roadmapId,
      workspaceId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      sortOrder,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    }),
    ...labelIds.map((labelId) =>
      db.insert(taskLabels).values({ taskId: id, labelId, workspaceId }),
    ),
  ]);
  return (await findTask(db, workspaceId, roadmapId, id))!;
};

export const updateTask = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  roadmapId: string,
  taskId: string,
  body: unknown,
) => {
  assertIds(workspaceId, roadmapId, taskId);
  await requireMember(db, workspaceId, actorId);
  const current = await findTask(db, workspaceId, roadmapId, taskId);
  if (!current) throw notFound();

  const input = parseInput(updateTaskInputFor(current), body);
  const labelIds = input.labelIds && [...new Set(input.labelIds)];
  await checkReferences(db, workspaceId, { assigneeId: input.assigneeId, labelIds });

  const status = input.status ?? current.status;
  const moves =
    status !== current.status ||
    input.beforeTaskId !== undefined ||
    input.afterTaskId !== undefined;
  const sortOrder = moves
    ? await sortOrderForMove(db, current, status, input.beforeTaskId, input.afterTaskId)
    : undefined;

  const update = db
    .update(tasks)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(sortOrder !== undefined && { sortOrder }),
      updatedAt: nowIso(),
      version: sql`${tasks.version} + 1`,
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.version, input.version)))
    .returning({ id: tasks.id });

  // ラベルの付け替えは、versionが一致しているときだけ適用する。
  // バッチは1つのトランザクションなので、更新（versionを進める）より前に同じ条件で守る。
  const sameVersion = sql`exists (select 1 from ${tasks} where ${tasks.id} = ${taskId} and ${tasks.version} = ${input.version})`;
  const relabel: BatchItem<"sqlite">[] =
    labelIds === undefined
      ? []
      : [
          db.delete(taskLabels).where(and(eq(taskLabels.taskId, taskId), sameVersion)),
          ...labelIds.map((labelId) =>
            db
              .insert(taskLabels)
              .select(sql`select ${taskId}, ${labelId}, ${workspaceId} where ${sameVersion}`),
          ),
        ];

  let updated: { id: string }[];
  if (relabel.length === 0) {
    updated = await update;
  } else {
    const statements = [...relabel, update] as unknown as [
      BatchItem<"sqlite">,
      ...BatchItem<"sqlite">[],
    ];
    const results = await db.batch(statements);
    updated = results.at(-1) as { id: string }[];
  }
  if (updated.length === 0) {
    if (!(await findTask(db, workspaceId, roadmapId, taskId))) throw notFound();
    throw versionConflict();
  }
  return (await findTask(db, workspaceId, roadmapId, taskId))!;
};

export const deleteTask = async (
  db: Db,
  actorId: string,
  workspaceId: string,
  roadmapId: string,
  taskId: string,
) => {
  assertIds(workspaceId, roadmapId, taskId);
  await requireMember(db, workspaceId, actorId);
  // コメントとラベルの紐づけは外部キーの連鎖削除で消える。
  const deleted = await db
    .delete(tasks)
    .where(
      and(eq(tasks.id, taskId), eq(tasks.roadmapId, roadmapId), eq(tasks.workspaceId, workspaceId)),
    )
    .returning({ id: tasks.id });
  if (deleted.length === 0) throw notFound();
};
