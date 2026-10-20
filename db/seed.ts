import { defineSeed } from "void/seed";
import { devFixtures } from "./dev-fixtures";

const now = "2026-01-01T00:00:00.000Z";

export default defineSeed<typeof import("./schema")>(async ({ db, schema }) => {
  await db.insert(schema.users).values({
    id: devFixtures.userId,
    name: "開発ユーザー",
    email: "dev@example.com",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.workspaces).values({
    id: devFixtures.workspaceId,
    name: "開発用ワークスペース",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.memberships).values({
    id: "0190a000-0000-7000-8000-000000000011",
    workspaceId: devFixtures.workspaceId,
    userId: devFixtures.userId,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.projects).values({
    id: devFixtures.projectId,
    workspaceId: devFixtures.workspaceId,
    name: "学習プロジェクト",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.roadmaps).values({
    id: devFixtures.roadmapId,
    projectId: devFixtures.projectId,
    workspaceId: devFixtures.workspaceId,
    name: "はじめてのロードマップ",
    description: null,
    createdBy: devFixtures.userId,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.labels).values({
    id: devFixtures.labelId,
    workspaceId: devFixtures.workspaceId,
    name: "基礎",
    color: "#3B82F6",
    createdAt: now,
    updatedAt: now,
  });
});
