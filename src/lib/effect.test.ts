import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";
import { runPromise } from "./effect";

describe("EffectとPromiseの境界", () => {
  test("成功値をそのまま返す", async () => {
    const value = { id: "task" };
    await expect(runPromise(Effect.succeed(value))).resolves.toBe(value);
  });

  test("型付きの失敗を包まず同じオブジェクトで伝える", async () => {
    const error = Object.assign(new Error("conflict"), { _tag: "HttpError", status: 409 });
    await expect(runPromise(Effect.fail(error))).rejects.toBe(error);
  });

  test("予期しない例外を成功値として扱わない", async () => {
    await expect(runPromise(Effect.die(new Error("unexpected")))).rejects.toThrow("unexpected");
  });
});
