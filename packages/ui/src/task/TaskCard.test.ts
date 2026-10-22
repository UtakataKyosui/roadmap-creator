import { describe, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Task } from "@roadmapper/api-contract/models";
import { TaskCard } from "./TaskCard";

const task: Task = {
  id: "0190a000-0000-7000-8000-000000000003",
  roadmapId: "0190a000-0000-7000-8000-000000000002",
  workspaceId: "0190a000-0000-7000-8000-000000000001",
  title: "長いタイトル".repeat(40),
  description: null,
  status: "todo",
  priority: "urgent",
  assigneeId: null,
  startDate: null,
  dueDate: null,
  labelIds: [],
  sortOrder: "a0",
  commentCount: 0,
  createdBy: "0190a000-0000-7000-8000-000000000001",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

describe("TaskCard", () => {
  test("担当者・期限が未設定でもタイトル・優先度・コメント数0を表示する", () => {
    const html = renderToStaticMarkup(createElement(TaskCard, { task, today: "2026-01-05" }));
    expect(html).toContain("担当者未設定");
    expect(html).toContain("未設定");
    expect(html).toContain("緊急");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain(">0<");
  });

  test("担当者・期限超過・ラベルを表示する", () => {
    const html = renderToStaticMarkup(
      createElement(TaskCard, {
        task: { ...task, title: "t", dueDate: "2026-01-01", commentCount: 3 },
        assignee: { name: "山田", avatarUrl: null },
        labels: [
          {
            id: "l",
            workspaceId: "w",
            name: "基礎",
            color: "#112233",
            createdAt: "t",
            updatedAt: "t",
          },
        ],
        today: "2026-01-05",
      }),
    );
    expect(html).toContain("山田");
    expect(html).toContain("（期限超過）");
    expect(html).toContain("1/1");
    expect(html).toContain("基礎");
    expect(html).toContain(">3<");
  });
});
