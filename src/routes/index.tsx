import { createFileRoute } from "@tanstack/react-router";
import { WorkspacesPage } from "@/components/workspaces/WorkspacesPage";

// 入口はワークスペースの一覧・作成画面。下位ページへ自動転送せず、作業先を選べるようにする。
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "ワークスペース | Roadmap Studio" }] }),
  component: WorkspacesPage,
});
