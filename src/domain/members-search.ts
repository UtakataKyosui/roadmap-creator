import { isUuid } from "@/server/ids";

// メンバー画面から元のプロジェクトへ戻るための検索条件。
export type MembersSearch = { projectId?: string };

export const parseMembersSearch = (raw: Record<string, unknown>): MembersSearch =>
  typeof raw.projectId === "string" && isUuid(raw.projectId) ? { projectId: raw.projectId } : {};

// 戻り先に指定されたアクティブなプロジェクト。無い・アーカイブ済みなら最初のアクティブなプロジェクト。
export const pickReturnProject = <P extends { id: string; archivedAt?: string | null }>(
  projects: readonly P[],
  projectId?: string,
): P | undefined => {
  const active = projects.filter((project) => !project.archivedAt);
  return active.find((project) => project.id === projectId) ?? active[0];
};
