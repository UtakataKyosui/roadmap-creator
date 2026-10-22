import { describe, expect, test } from "vite-plus/test";
import { CreateTaskInput } from "@/api/validation";
import {
  addDays,
  diffDays,
  formatShortDate,
  hasValidDateRange,
  inclusiveDays,
  isOverdue,
  parseCalendarDate,
  todayCalendarDate,
} from "./calendar-date";
import { PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES, progressPercent } from "./task";

describe("進捗率とラベル", () => {
  test("statusから算出し、列順はtodo→in_progress→review→done", () => {
    expect(TASK_STATUSES.map(progressPercent)).toEqual([0, 33, 67, 100]);
    expect(TASK_STATUSES.map((s) => STATUS_LABEL[s])).toEqual([
      "未着手",
      "進行中",
      "振り返り",
      "完了",
    ]);
    expect(Object.values(PRIORITY_LABEL)).toEqual(["低", "中", "高", "緊急"]);
  });
});

describe("CalendarDate", () => {
  test("存在しない日付や書式違いは不正として扱う", () => {
    expect(parseCalendarDate("2026-02-30")).toBeNull();
    expect(parseCalendarDate("2026-2-3")).toBeNull();
    expect(parseCalendarDate("2024-02-29")).not.toBeNull();
    expect(parseCalendarDate("2026-02-29")).toBeNull();
  });

  test("日数の計算はタイムゾーンや月またぎに左右されない", () => {
    expect(inclusiveDays("2026-01-31", "2026-02-02")).toBe(3);
    expect(inclusiveDays("2026-03-01", "2026-03-01")).toBe(1);
    expect(inclusiveDays("2026-03-02", "2026-03-01")).toBeNull();
    expect(diffDays("2026-12-31", "2027-01-02")).toBe(2);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  test("今日は端末の暦日で、期限超過は未完了のときだけ", () => {
    expect(todayCalendarDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(isOverdue("2026-01-04", "todo", "2026-01-05")).toBe(true);
    expect(isOverdue("2026-01-05", "todo", "2026-01-05")).toBe(false);
    expect(isOverdue("2026-01-04", "done", "2026-01-05")).toBe(false);
    expect(isOverdue(null, "todo", "2026-01-05")).toBe(false);
  });

  test("表示は月/日で、未設定は『未設定』", () => {
    expect(formatShortDate("2026-03-09")).toBe("3/9");
    expect(formatShortDate(null)).toBe("未設定");
  });

  test("日付範囲の検証はフォームの入力検証と共有される", () => {
    expect(hasValidDateRange({ startDate: "2026-02-01", dueDate: "2026-01-01" })).toBe(false);
    expect(hasValidDateRange({ startDate: null, dueDate: "2026-01-01" })).toBe(true);
    const result = CreateTaskInput.safeParse({
      title: "t",
      startDate: "2026-02-01",
      dueDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });
});
