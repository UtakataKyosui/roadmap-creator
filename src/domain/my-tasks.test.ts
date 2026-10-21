import { describe, expect, test } from "vite-plus/test";
import {
  hasActiveFilters,
  pageCount,
  parseMyTasksSearch,
  toApiParams,
  withFilter,
} from "./my-tasks";

describe("マイタスクの検索条件", () => {
  test("有効な値だけを取り出し、不正な値・1ページ目の指定は捨てる", () => {
    expect(
      parseMyTasksSearch({ q: "  設計 ", status: "review", due: "thisWeek", page: "3" }),
    ).toEqual({ q: "設計", status: "review", due: "thisWeek", page: 3 });
    expect(parseMyTasksSearch({ q: "  ", status: "nope", due: "later", page: "1" })).toEqual({});
    expect(parseMyTasksSearch({ page: "-4" })).toEqual({});
    expect(parseMyTasksSearch({ page: "2.5" })).toEqual({});
  });

  test("条件を変えるとページが1に戻り、他の条件は保たれる", () => {
    expect(withFilter({ q: "a", status: "todo", page: 4 }, { due: "overdue" })).toEqual({
      q: "a",
      status: "todo",
      due: "overdue",
    });
    expect(withFilter({ q: "a", page: 4 }, { q: undefined })).toEqual({});
  });

  test("APIの引数に変換する（担当者は含めない）", () => {
    expect(toApiParams({}, "2026-06-10")).toEqual({
      today: "2026-06-10",
      page: 1,
      pageSize: 20,
    });
    expect(toApiParams({ q: "a", status: "done", due: "today", page: 2 }, "2026-06-10")).toEqual({
      today: "2026-06-10",
      page: 2,
      pageSize: 20,
      q: "a",
      status: ["done"],
      due: ["today"],
    });
  });

  test("絞り込み中かどうか、総ページ数（0件でも1）", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ page: 3 })).toBe(false);
    expect(hasActiveFilters({ due: "today" })).toBe(true);
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
  });
});
