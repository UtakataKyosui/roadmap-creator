import { env } from "void/env";

export type InvitationMail = {
  to: string;
  workspaceName: string;
  invitedByName: string;
  // 受諾画面のパス（オリジンを含まない）。
  invitePath: string;
};

export type Mailer = {
  // falseは送信を行わなかった場合。送信事業者は完了時にvoidを返してもよい。
  sendInvitation: (mail: InvitationMail) => Promise<void | false>;
};

const appOrigin = () => {
  try {
    return (env as { API_ORIGIN?: string }).API_ORIGIN ?? "http://localhost:3000";
  } catch {
    return "http://localhost:3000";
  }
};

// メール送信の事業者を決めるまでの実装。送信しない。
// 開発ビルドでは、宛先と招待URLをサーバーのログに出す。ローカルでは、このログのURLか、
// 招待の作成応答のinviteUrlで受諾画面を開いて確認する。招待URLは秘密のため、本番のログには出さない。
export const logMailer: Mailer = {
  sendInvitation: async ({ to, workspaceName, invitedByName, invitePath }) => {
    if (import.meta.env.DEV) {
      console.info(
        `[mail] ${to} 宛: ${invitedByName}さんが「${workspaceName}」へ招待しています ${appOrigin()}${invitePath}`,
      );
    }
    return false;
  },
};
