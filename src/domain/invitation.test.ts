import { describe, expect, test } from "vite-plus/test";
import { absoluteInviteUrl, canManageInvitations } from "./invitation";

describe("招待の画面ロジック", () => {
  test("招待を管理できるのはowner/adminだけ", () => {
    expect(canManageInvitations("owner")).toBe(true);
    expect(canManageInvitations("admin")).toBe(true);
    expect(canManageInvitations("member")).toBe(false);
    expect(canManageInvitations(undefined)).toBe(false);
  });

  test("招待URLを絶対URLにする", () => {
    expect(absoluteInviteUrl("/invitations/abc", "https://app.example.com")).toBe(
      "https://app.example.com/invitations/abc",
    );
  });
});
