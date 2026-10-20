import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "void/schema-d1";

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
  (t) => [index("projects_workspace_idx").on(t.workspaceId)],
);

export const roadmaps = sqliteTable(
  "roadmaps",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
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
  (t) => [uniqueIndex("labels_workspace_name_unique").on(t.workspaceId, t.name)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    roadmapId: text("roadmap_id")
      .notNull()
      .references(() => roadmaps.id, { onDelete: "cascade" }),
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
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
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
  ],
);

export const taskLabels = sqliteTable(
  "task_labels",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] })],
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
