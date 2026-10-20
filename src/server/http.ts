import { toErrorResponse, validationFailed } from "./errors";
import { resolveActorId } from "./auth";

export const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    throw validationFailed([{ path: "", message: "リクエスト本文をJSONとして解釈できません" }]);
  }
};

// ルートの共通処理。認証済みのユーザーIDを渡し、結果をJSONにし、例外を共通のエラー形式に変換する。
export const handle = async (run: (actorId: string) => Promise<unknown>, status = 200) => {
  try {
    const body = await run(resolveActorId());
    return Response.json(body, { status });
  } catch (error) {
    return toErrorResponse(error);
  }
};
