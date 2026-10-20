import type { ZodType, output } from "zod";
import { hasValidDateRange } from "@/domain/calendar-date";
import { CreateTaskBody, UpdateTaskBody } from "./generated/zod/tasks/tasks.zod";

export class ResponseValidationError extends Error {
  readonly issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;

  constructor(issues: ResponseValidationError["issues"]) {
    super("Response does not match the API contract");
    this.name = "ResponseValidationError";
    this.issues = issues;
  }
}

// HTTP境界で応答を検証する。契約と異なる応答は ResponseValidationError として画面へ伝える。
export const parseResponse = <S extends ZodType>(schema: S, data: unknown): output<S> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ResponseValidationError(result.error.issues);
  }
  return result.data;
};

// 生成されたZodスキーマでは表せない横断検証。開始日は期限日以前でなければならない。
type DateRange = { startDate?: string | null; dueDate?: string | null };

const dateRangeIssue = {
  message: "開始日は期限日以前にしてください",
  path: ["dueDate"],
};

export const CreateTaskInput = CreateTaskBody.refine(hasValidDateRange, dateRangeIssue);

// 部分更新は片方の日付しか送らないことがある。省略した側は現在のタスクの値で補って検証する。
export const updateTaskInputFor = (current: DateRange) =>
  UpdateTaskBody.refine(
    (patch) =>
      hasValidDateRange({
        startDate: patch.startDate === undefined ? current.startDate : patch.startDate,
        dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate,
      }),
    dateRangeIssue,
  );
