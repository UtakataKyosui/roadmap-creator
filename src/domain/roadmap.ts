import { createRoadmapBodyNameMax } from "@/api/generated/zod/roadmaps/roadmaps.zod";

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
