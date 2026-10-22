import { ApiError, InvalidResponseError, RequestAbortedError } from "./http";
import { ResponseValidationError } from "@roadmapper/domain/validation";

// 画面にはAPIのmessageをそのまま出さず、codeで文言を決める。
export const apiErrorMessage = (error: unknown) => {
  if (error instanceof RequestAbortedError) return "リクエストがキャンセルされました。";
  if (error instanceof InvalidResponseError || error instanceof ResponseValidationError) {
    return "サーバーからの応答が正しくありません。";
  }
  if (error instanceof ApiError) {
    switch (error.code) {
      case "unauthorized":
        return "ログインが必要です。";
      case "forbidden":
        return "この内容を見る権限がありません。";
      case "not_found":
        return "対象が見つかりません。削除されたか、アクセスできない可能性があります。";
      case "version_conflict":
        return "他のユーザーが先に更新しました。最新の内容を読み込み直してください。";
      case "validation_failed":
        return "入力内容を確認してください。";
      default:
        return "サーバーでエラーが発生しました。時間をおいてもう一度お試しください。";
    }
  }
  if (error instanceof TypeError) return "ネットワークに接続できません。接続を確認してください。";
  return "予期しないエラーが発生しました。";
};

// 再試行しても結果が変わらないエラー（権限・存在しない・検証）には再試行手段を出さない。
export const isRetryable = (error: unknown) =>
  error instanceof ApiError ? error.status >= 500 : error instanceof TypeError;
