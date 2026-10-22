import { Effect, Result } from "effect";

// Promiseベースのフレームワークとの境界でのみ実行する。
// runPromiseが生成するFiberFailureで包まず、型付きの失敗をそのまま伝える。
export const runPromise = async <A, E>(program: Effect.Effect<A, E>): Promise<A> => {
  const result = await Effect.runPromise(Effect.result(program));
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};
