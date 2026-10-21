export type View = "board" | "timeline";

export const VIEW_LABEL: Record<View, string> = { board: "ボード", timeline: "タイムライン" };

// Workspace > Project > Roadmap > 画面 の順。名前が取得できないときはIDの代わりに「…」を出す。
export const buildBreadcrumb = (names: {
  workspace?: string;
  project?: string;
  roadmap?: string;
  view?: View;
}) => {
  const items: string[] = [names.workspace ?? "…", names.project ?? "…"];
  if (names.roadmap !== undefined || names.view !== undefined) items.push(names.roadmap ?? "…");
  if (names.view !== undefined) items.push(VIEW_LABEL[names.view]);
  return items;
};
