import { describe, expect, test } from "vite-plus/test";
import { parseMembersSearch, pickReturnProject } from "./members-search";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("メンバー画面の戻り先", () => {
  test("UUIDのprojectIdだけを受け付ける", () => {
    expect(parseMembersSearch({ projectId: B })).toEqual({ projectId: B });
    expect(parseMembersSearch({ projectId: "x" })).toEqual({});
    expect(parseMembersSearch({})).toEqual({});
  });

  test("指定されたアクティブなプロジェクトを戻り先にする", () => {
    const projects = [{ id: A }, { id: B }];
    expect(pickReturnProject(projects, B)?.id).toBe(B);
  });

  test("指定が無い・アーカイブ済み・他ワークスペースのIDなら最初のアクティブなプロジェクトにする", () => {
    const projects = [
      { id: A, archivedAt: "2026-01-01T00:00:00Z" },
      { id: B, archivedAt: null },
    ];
    expect(pickReturnProject(projects, A)?.id).toBe(B);
    expect(pickReturnProject(projects)?.id).toBe(B);
    expect(pickReturnProject(projects, "33333333-3333-4333-8333-333333333333")?.id).toBe(B);
    expect(pickReturnProject([])).toBeUndefined();
  });
});
