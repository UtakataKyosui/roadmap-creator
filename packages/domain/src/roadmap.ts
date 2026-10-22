import { createRoadmapBodyNameMax } from "@roadmapper/api-contract/zod/roadmaps/roadmaps.zod";
import { hasValidDateRange, inclusiveDays, parseCalendarDate } from "./calendar-date";

export type RoadmapPeriod = { startDate: string | null; dueDate: string | null };

export const validateRoadmapPeriod = ({ startDate, dueDate }: RoadmapPeriod) => {
  if (
    (startDate && parseCalendarDate(startDate) === null) ||
    (dueDate && parseCalendarDate(dueDate) === null)
  ) {
    return "正しい日付を入力してください";
  }
  return hasValidDateRange({ startDate, dueDate }) ? null : "完了予定日は開始日以降にしてください";
};

export const roadmapPeriodLabel = ({ startDate, dueDate }: Partial<RoadmapPeriod>) => {
  if (startDate && dueDate)
    return `${startDate} 〜 ${dueDate}（${inclusiveDays(startDate, dueDate)}日間）`;
  if (dueDate) return `完了予定日：${dueDate}`;
  if (startDate) return `開始日：${startDate}`;
  return "期間は未設定";
};

export type NameResult = { ok: true; name: string } | { ok: false; message: string };

// 名称は前後の空白を除いて保存する。空白のみ・長すぎる入力は保存せず理由を返す。
export const validateRoadmapName = (input: string): NameResult => {
  const name = input.trim();
  if (name === "") return { ok: false, message: "名称を入力してください" };
  if (input.length > createRoadmapBodyNameMax) {
    return { ok: false, message: `名称は${createRoadmapBodyNameMax}文字以内で入力してください` };
  }
  return { ok: true, name };
};
