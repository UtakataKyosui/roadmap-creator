import { Effect, Either } from "effect";

// Promiseベースのフレームワークとの境界でのみ実行する。
// runPromiseが生成するFiberFailureで包まず、型付きの失敗をそのまま伝える。
export const runPromise = async <A, E>(program: Effect.Effect<A, E>): Promise<A> => {
  const result = await Effect.runPromise(Effect.either(program));
  if (Either.isLeft(result)) throw result.left;
  return result.right;
};
