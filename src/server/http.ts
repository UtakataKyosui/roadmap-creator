import { Effect } from "effect";
import { runPromise } from "@/lib/effect";
import { serverEffect, toErrorResponse, validationFailed, UnexpectedServerError } from "./errors";
import { resolveActorIdEffect } from "./auth";

export const readJsonEffect = (request: Request) =>
  Effect.tryPromise({
    try: (): Promise<unknown> => request.json(),
    catch: () =>
      validationFailed([{ path: "", message: "リクエスト本文をJSONとして解釈できません" }]),
  });

export const readJson = (request: Request): Promise<unknown> => runPromise(readJsonEffect(request));

// ルートの共通処理。認証済みのユーザーIDを渡し、結果をJSONにし、例外を共通のエラー形式に変換する。
export const handleEffect = (run: (actorId: string) => Promise<unknown>, status = 200) =>
  Effect.gen(function* () {
    const actorId = yield* resolveActorIdEffect();
    const body = yield* serverEffect(() => run(actorId));
    return yield* Effect.try({
      try: () =>
        body === undefined ? new Response(null, { status }) : Response.json(body, { status }),
      catch: (cause) => new UnexpectedServerError({ cause }),
    });
  }).pipe(
    Effect.catchTags({
      HttpError: (error) => Effect.sync(() => toErrorResponse(error)),
      UnexpectedServerError: (error) => Effect.sync(() => toErrorResponse(error)),
    }),
  );

export const handle = (run: (actorId: string) => Promise<unknown>, status = 200) =>
  Effect.runPromise(handleEffect(run, status));
