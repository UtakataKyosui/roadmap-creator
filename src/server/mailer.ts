import { env } from "void/env";

export type InvitationMail = {
  to: string;
  workspaceName: string;
  invitedByName: string;
  // 受諾画面のパス（オリジンを含まない）。
  invitePath: string;
};

export type Mailer = {
  sendInvitation: (mail: InvitationMail) => Promise<void>;
};

const appOrigin = () => {
  try {
    return (env as { API_ORIGIN?: string }).API_ORIGIN ?? "http://localhost:3000";
  } catch {
    return "http://localhost:3000";
  }
};

// メール送信の事業者を決めるまでの実装。送信せず、宛先と招待URLをサーバーのログに出す。
// ローカルでは、このログのURLか、招待の作成応答のinviteUrlで受諾画面を開いて確認する。
export const logMailer: Mailer = {
  sendInvitation: async ({ to, workspaceName, invitedByName, invitePath }) => {
    console.info(
      `[mail] ${to} 宛: ${invitedByName}さんが「${workspaceName}」へ招待しています ${appOrigin()}${invitePath}`,
    );
  },
};
