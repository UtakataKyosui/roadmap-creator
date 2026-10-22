import type { ZodType, output } from "zod";
import { Data, Effect } from "effect";
import type { ErrorCode, ErrorDetail } from "@/api/generated/models";

export class HttpError extends Error {
  readonly _tag = "HttpError";
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ErrorDetail[] | undefined;

  constructor(status: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class UnexpectedServerError extends Data.TaggedError("UnexpectedServerError")<{
  readonly cause: unknown;
}> {}

export type ServerError = HttpError | UnexpectedServerError;

// 既存のDB/外部ライブラリのPromiseを取り込む境界。業務エラーを保持し、
// その他の失敗は内部情報を含むcauseとしてサーバー側に留める。
export const serverEffect = <A>(run: () => PromiseLike<A>): Effect.Effect<A, ServerError> =>
  Effect.tryPromise({
    try: () => Promise.resolve(run()),
    catch: (cause) =>
      cause instanceof HttpError || cause instanceof UnexpectedServerError
        ? cause
        : new UnexpectedServerError({ cause }),
  });

export const unauthorized = () => new HttpError(401, "unauthorized", "ログインが必要です");
export const forbidden = () => new HttpError(403, "forbidden", "この操作を行う権限がありません");
export const notFound = () => new HttpError(404, "not_found", "対象が見つかりません");
export const versionConflict = () =>
  new HttpError(409, "version_conflict", "他のユーザーが先に更新しました。再取得してください");
export const validationFailed = (details: ErrorDetail[]) =>
  new HttpError(422, "validation_failed", "入力が不正です", details);

const escapePointerSegment = (segment: PropertyKey) =>
  String(segment).replaceAll("~", "~0").replaceAll("/", "~1");

// ZodのissueのpathをJSONポインタ（例 /dueDate）に変換する。ルートは空文字。
export const toPointer = (path: ReadonlyArray<PropertyKey>) =>
  path.map((segment) => `/${escapePointerSegment(segment)}`).join("");

export const fieldError = (path: string, message: string): ErrorDetail => ({
  path: toPointer([path]),
  message,
});

export const parseInput = <S extends ZodType>(schema: S, data: unknown): output<S> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw validationFailed(
      result.error.issues.map((issue) => ({
        path: toPointer(issue.path),
        message: issue.message,
      })),
    );
  }
  return result.data;
};

export const toErrorResponse = (error: unknown) => {
  if (error instanceof HttpError) {
    return Response.json(
      {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
      { status: error.status },
    );
  }
  console.error(
    "Unhandled API error",
    error instanceof UnexpectedServerError ? error.cause : error,
  );
  return Response.json(
    { code: "internal", message: "サーバー内部でエラーが発生しました" },
    { status: 500 },
  );
};
