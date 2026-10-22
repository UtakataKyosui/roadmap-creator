import { sql } from "drizzle-orm";
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

export const invitations = sqliteTable(
  "invitations",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // 小文字に正規化して保存する。
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull(),
    // 招待URLのトークンはSHA-256のハッシュだけを保存する。
    tokenHash: text("token_hash").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id),
    expiresAt: text("expires_at").notNull(),
    acceptedAt: text("accepted_at"),
    acceptedBy: text("accepted_by").references(() => users.id),
    revokedAt: text("revoked_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("invitations_token_hash_unique").on(t.tokenHash),
    index("invitations_workspace_idx").on(t.workspaceId),
    // 同じメールアドレスへの招待中（未受諾・未取消）は、Workspaceごとに1件に限る。
    uniqueIndex("invitations_pending_unique")
      .on(t.workspaceId, t.email)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
  ],
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

// 以下はBetter Authが管理する認証テーブル。アプリのusersとは別に持ち、日時はBetter Authが扱うDate（ミリ秒）で保存する。
// アプリのusersには、同じIDでプロフィールを作る（src/server/auth.ts）。
const authTimestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
};

export const authUsers = sqliteTable(
  "auth_users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    ...authTimestamps,
  },
  (t) => [uniqueIndex("auth_users_email_unique").on(t.email)],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...authTimestamps,
  },
  (t) => [
    uniqueIndex("auth_sessions_token_unique").on(t.token),
    index("auth_sessions_user_idx").on(t.userId),
  ],
);

export const authAccounts = sqliteTable(
  "auth_accounts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    ...authTimestamps,
  },
  (t) => [
    // 同じGoogle主体の並行ログインでも、認証ユーザーを重複して作らない。
    uniqueIndex("auth_accounts_provider_account_unique").on(t.providerId, t.accountId),
    index("auth_accounts_user_idx").on(t.userId),
  ],
);

export const authVerifications = sqliteTable(
  "auth_verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ...authTimestamps,
  },
  (t) => [index("auth_verifications_identifier_idx").on(t.identifier)],
);
