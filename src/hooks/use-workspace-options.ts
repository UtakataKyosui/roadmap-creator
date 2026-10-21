import { useMemo } from "react";
import { useListLabels } from "@/api/generated/endpoints/labels/labels";
import { useListWorkspaceMembers } from "@/api/generated/endpoints/workspaces/workspaces";

// 担当者とラベルの選択肢。ボード・フォーム・詳細編集で共通に使う。
export const useWorkspaceOptions = (workspaceId: string) => {
  const membersQuery = useListWorkspaceMembers(workspaceId);
  const labelsQuery = useListLabels(workspaceId);

  const members = useMemo(
    () => (membersQuery.data?.status === 200 ? membersQuery.data.data : []),
    [membersQuery.data],
  );
  const labels = useMemo(
    () => (labelsQuery.data?.status === 200 ? labelsQuery.data.data : []),
    [labelsQuery.data],
  );
  const memberById = useMemo(() => new Map(members.map((m) => [m.user.id, m.user])), [members]);
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  return {
    members,
    labels,
    memberById,
    labelById,
    isPending: membersQuery.isPending || labelsQuery.isPending,
    error: membersQuery.error ?? labelsQuery.error,
  };
};
