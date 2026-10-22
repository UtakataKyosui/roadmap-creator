import { describe, expect, test } from "vite-plus/test";
import { buildBreadcrumb } from "./breadcrumb";

describe("パンくず", () => {
  test("Workspace > Project > Roadmap > 画面 の順で、画面は日本語名になる", () => {
    expect(
      buildBreadcrumb({ workspace: "W", project: "P", roadmap: "R", view: "timeline" }),
    ).toEqual(["W", "P", "R", "タイムライン"]);
    expect(buildBreadcrumb({ workspace: "W", project: "P" })).toEqual(["W", "P"]);
  });

  test("名前が未取得の階層は省略記号で埋める", () => {
    expect(buildBreadcrumb({ roadmap: "R", view: "board" })).toEqual(["…", "…", "R", "ボード"]);
  });
});
