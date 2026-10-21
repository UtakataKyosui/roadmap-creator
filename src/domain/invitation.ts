import type { InvitationRole, InvitationStatus, MembershipRole } from "@/api/generated/models";

export const ROLE_LABEL: Record<MembershipRole, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
};

export const INVITATION_ROLES = ["member", "admin"] as const satisfies readonly InvitationRole[];

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: "招待中",
  accepted: "参加済み",
  revoked: "取消",
  expired: "期限切れ",
};

export const INVITATION_STATUS_TONE: Record<InvitationStatus, string> = {
  pending: "bg-indigo-tint text-indigo",
  accepted: "bg-teal-tint text-teal",
  revoked: "bg-surface-subtle text-subtle-foreground",
  expired: "bg-amber-tint text-amber",
};

// 招待の管理（招待・再送・取消）ができるのはowner/adminだけ。
export const canManageInvitations = (role: MembershipRole | undefined) =>
  role === "owner" || role === "admin";

// 招待URL（相対パス）を、共有できる絶対URLにする。
export const absoluteInviteUrl = (path: string, origin: string) => new URL(path, origin).toString();
