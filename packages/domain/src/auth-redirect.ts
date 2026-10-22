const DEFAULT_REDIRECT = "/";

// ログイン後の戻り先は、同じオリジンの絶対パスだけを許す。
// `//host` や `/\host`、スキーム付きのURLは外部へ遷移させられるため、既定の戻り先に置き換える。
export const safeRedirect = (value: unknown) => {
  if (typeof value !== "string") return DEFAULT_REDIRECT;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_REDIRECT;
  }
  if (Array.from(value).some((char) => char.charCodeAt(0) < 0x20)) return DEFAULT_REDIRECT;
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/api/")) {
    return DEFAULT_REDIRECT;
  }
  return value;
};

export const loginUrl = (returnTo: string) => {
  const target = safeRedirect(returnTo);
  return target === DEFAULT_REDIRECT ? "/login" : `/login?redirect=${encodeURIComponent(target)}`;
};

// Better Authが認証失敗時に付けるerrorクエリを、画面に出す文言に変える。
// コードや内部情報はそのまま表示しない。
export const loginErrorMessage = (code: string | undefined) => {
  if (!code) return undefined;
  switch (code) {
    case "access_denied":
    case "user_cancelled_authorize":
      return "Googleでの認証がキャンセルされました。もう一度お試しください。";
    case "email_already_used":
    case "unable_to_create_user":
      return "このメールアドレスは別のアカウントで使われているため、ログインできません。";
    case "network":
      return "通信に失敗しました。接続を確認して、もう一度お試しください。";
    default:
      return "ログインできませんでした。時間をおいてもう一度お試しください。";
  }
};
