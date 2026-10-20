import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "void/schema-d1";

// IDはサーバーが採番するUUID v7、日時はUTCのRFC 3339文字列で保存する。
const id = () => text("id").primaryKey();
const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const users = sqliteTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const workspaces = sqliteTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  ...timestamps,
  version: integer("version").notNull().default(1),
});

export const memberships = sqliteTable(
  "memberships",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("memberships_workspace_user_unique").on(t.workspaceId, t.userId)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    archivedAt: text("archived_at"),
    ...timestamps,
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("projects_workspace_idx").on(t.workspaceId),
    // 子テーブルが (id, workspace_id) の組で参照し、親と同じWorkspaceに限定する。
    uniqueIndex("projects_id_workspace_unique").on(t.id, t.workspaceId),
  ],
);

export const roadmaps = sqliteTable(
  "roadmaps",
  {
    id: id(),
    projectId: text("project_id").notNull(),
    // 権限判定を1回の検索で済ませるため、所属Workspaceを非正規化して持つ。
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    archivedAt: text("archived_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("roadmaps_project_idx").on(t.projectId),
    index("roadmaps_workspace_idx").on(t.workspaceId),
    uniqueIndex("roadmaps_id_workspace_unique").on(t.id, t.workspaceId),
    foreignKey({
      columns: [t.projectId, t.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
    }).onDelete("cascade"),
  ],
);

export const labels = sqliteTable(
  "labels",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("labels_workspace_name_unique").on(t.workspaceId, t.name),
    uniqueIndex("labels_id_workspace_unique").on(t.id, t.workspaceId),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    roadmapId: text("roadmap_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: ["todo", "in_progress", "review", "done"] })
      .notNull()
      .default("todo"),
    priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
      .notNull()
      .default("medium"),
    assigneeId: text("assignee_id"),
    startDate: text("start_date"),
    dueDate: text("due_date"),
    sortOrder: text("sort_order").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("tasks_roadmap_status_order_idx").on(t.roadmapId, t.status, t.sortOrder),
    index("tasks_assignee_idx").on(t.assigneeId),
    uniqueIndex("tasks_id_workspace_unique").on(t.id, t.workspaceId),
    foreignKey({
      columns: [t.roadmapId, t.workspaceId],
      foreignColumns: [roadmaps.id, roadmaps.workspaceId],
    }).onDelete("cascade"),
    // 担当者は同じWorkspaceのメンバーに限る。assignee_idがNULLのときは検査されない。
    foreignKey({
      columns: [t.workspaceId, t.assigneeId],
      foreignColumns: [memberships.workspaceId, memberships.userId],
    }),
  ],
);

export const taskLabels = sqliteTable(
  "task_labels",
  {
    taskId: text("task_id").notNull(),
    labelId: text("label_id").notNull(),
    // タスクとラベルが同じWorkspaceに属することを外部キーで保証する。
    workspaceId: text("workspace_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.labelId] }),
    foreignKey({
      columns: [t.taskId, t.workspaceId],
      foreignColumns: [tasks.id, tasks.workspaceId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.labelId, t.workspaceId],
      foreignColumns: [labels.id, labels.workspaceId],
    }).onDelete("cascade"),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("comments_task_idx").on(t.taskId)],
);
