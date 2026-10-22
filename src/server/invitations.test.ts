import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { parseResponse } from "../api/validation";
import {
  CreateInvitationResponse,
  GetInvitationPreviewResponse,
} from "@roadmapper/api-contract/zod/invitations/invitations.zod";
import { devFixtures } from "../../db/dev-fixtures";
import {
  acceptInvitation,
  createInvitation,
  getInvitationPreview,
  listInvitations,
  resendInvitation,
  revokeInvitation,
} from "./invitations";
import type { InvitationMail, Mailer } from "./mailer";
import { logMailer } from "./mailer";
import { listWorkspaceMembers } from "./workspaces";
import { createTestDb, otherUserId, seedTestDb } from "./testing/test-db";

const { userId, workspaceId } = devFixtures;
const now = new Date("2026-06-10T00:00:00.000Z");
const later = new Date("2026-06-18T00:00:00.000Z");

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];
let sent: InvitationMail[];
let mailer: Mailer;

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedTestDb(sqlite);
  sent = [];
  mailer = { sendInvitation: async (mail) => void sent.push(mail) };
});

const invite = (email = "other@example.com", actor: string = userId, body: object = {}) =>
  createInvitation(db, actor, workspaceId, { email, ...body }, { mailer, now });

const tokenOf = (inviteUrl: string) => inviteUrl.split("/").pop()!;

const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error: { status?: number }) => error.status ?? 500,
  );

const reasons = (promise: Promise<unknown>) =>
  promise.then(
    () => [],
    (error: { details?: { message: string }[] }) => (error.details ?? []).map((d) => d.message),
  );

const memberCount = (user: string) =>
  (
    sqlite
      .prepare("SELECT count(*) AS n FROM memberships WHERE workspace_id = ? AND user_id = ?")
      .get(workspaceId, user) as { n: number }
  ).n;

describe("招待の作成", () => {
  test("ログ出力のみのMailerは未送信を返し、URLで共有できる", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const issued = await createInvitation(
        db,
        userId,
        workspaceId,
        { email: "other@example.com" },
        { mailer: logMailer, now },
      );
      expect(issued.emailSent).toBe(false);
      expect(
        (
          await resendInvitation(db, userId, workspaceId, issued.invitation.id, {
            mailer: logMailer,
            now,
          })
        ).emailSent,
      ).toBe(false);
    } finally {
      log.mockRestore();
    }
  });

  test.each([false, true])(
    "同時作成で先行する招待を取り消さない（期限切れ行あり=%s）",
    async (expired) => {
      if (expired) await invite();
      const at = expired ? later : now;
      const batch = db.batch.bind(db);
      let first: Awaited<ReturnType<typeof createInvitation>> | undefined;
      const interleaved = vi.spyOn(db, "batch").mockImplementationOnce(async (queries) => {
        first = await createInvitation(
          db,
          userId,
          workspaceId,
          { email: "other@example.com" },
          { mailer, now: at },
        );
        return batch(queries);
      });
      try {
        await expect(
          createInvitation(
            db,
            userId,
            workspaceId,
            { email: "other@example.com" },
            { mailer, now: at },
          ),
        ).rejects.toMatchObject({ status: 422 });
        expect(
          (await getInvitationPreview(db, otherUserId, tokenOf(first!.inviteUrl), { now: at }))
            .status,
        ).toBe("pending");
        expect(sent).toHaveLength(expired ? 2 : 1);
      } finally {
        interleaved.mockRestore();
      }
    },
  );

  test("招待中の招待を作り、トークンを保存せず、メールを送る", async () => {
    const issued = await invite("Other@Example.com ");
    parseResponse(CreateInvitationResponse, issued);
    expect(issued.invitation).toMatchObject({
      email: "other@example.com",
      role: "member",
      status: "pending",
      invitedBy: userId,
      expiresAt: "2026-06-17T00:00:00.000Z",
    });
    expect(issued.emailSent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "other@example.com", invitePath: issued.inviteUrl });

    const stored = sqlite.prepare("SELECT token_hash FROM invitations").get() as {
      token_hash: string;
    };
    expect(stored.token_hash).not.toContain(tokenOf(issued.inviteUrl));
    expect(stored.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("メール送信に失敗しても招待は作られ、inviteUrlで共有できる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing: Mailer = {
      sendInvitation: async () => {
        throw new Error("smtp down");
      },
    };
    const issued = await createInvitation(
      db,
      userId,
      workspaceId,
      { email: "a@example.com" },
      { mailer: failing, now },
    );
    expect(issued.emailSent).toBe(false);
    expect((await listInvitations(db, userId, workspaceId, { now }))[0]?.status).toBe("pending");
  });

  test("不正なメールアドレス、既存メンバー、招待中の重複は422で理由を返す", async () => {
    expect(await status(invite("not-an-email"))).toBe(422);
    expect(await status(invite("dev@example.com"))).toBe(422);
    expect(await reasons(invite("dev@example.com"))).toEqual([
      "このメールアドレスのユーザーは既にメンバーです",
    ]);
    await invite("new@example.com");
    expect(await status(invite("NEW@example.com"))).toBe(422);
  });

  test("期限切れの招待が残っていれば、取り消して新しい招待を作る", async () => {
    await invite("new@example.com");
    const reissued = await createInvitation(
      db,
      userId,
      workspaceId,
      { email: "new@example.com" },
      { mailer, now: later },
    );
    expect(reissued.invitation.status).toBe("pending");
    const statuses = (await listInvitations(db, userId, workspaceId, { now: later })).map(
      (i) => i.status,
    );
    expect(statuses.toSorted()).toEqual(["pending", "revoked"]);
  });

  test("owner/admin以外は招待も一覧もできず、メンバー以外はなおさらできない", async () => {
    sqlite
      .prepare(
        "INSERT INTO memberships (id,workspace_id,user_id,role,created_at,updated_at) VALUES ('0190a000-0000-7000-8000-0000000000c1',?,?,'member','t','t')",
      )
      .run(workspaceId, otherUserId);
    expect(await status(invite("x@example.com", otherUserId))).toBe(403);
    expect(await status(listInvitations(db, otherUserId, workspaceId))).toBe(403);
    expect(
      await status(
        createInvitation(db, userId, "0190a000-0000-7000-8000-0000000000ff", { email: "a@b.co" }),
      ),
    ).toBe(404);
  });
});

describe("招待の再送と取消", () => {
  test("再送すると新しいURLに替わり、期限が延び、古いURLは使えない", async () => {
    const first = await invite();
    const resent = await resendInvitation(db, userId, workspaceId, first.invitation.id, {
      mailer,
      now: later,
    });
    expect(resent.inviteUrl).not.toBe(first.inviteUrl);
    expect(resent.invitation).toMatchObject({
      status: "pending",
      expiresAt: "2026-06-25T00:00:00.000Z",
    });
    expect(sent).toHaveLength(2);
    expect(await status(getInvitationPreview(db, otherUserId, tokenOf(first.inviteUrl)))).toBe(404);
    expect(await status(getInvitationPreview(db, otherUserId, tokenOf(resent.inviteUrl)))).toBe(
      200,
    );
  });

  test("取り消すと受諾できず、取消は冪等。取消済みは再送できない", async () => {
    const issued = await invite();
    await revokeInvitation(db, userId, workspaceId, issued.invitation.id, { now });
    await revokeInvitation(db, userId, workspaceId, issued.invitation.id, { now });
    expect(
      await reasons(acceptInvitation(db, otherUserId, tokenOf(issued.inviteUrl), { now })),
    ).toEqual(["この招待は取り消されました"]);
    expect(
      await status(
        resendInvitation(db, userId, workspaceId, issued.invitation.id, { mailer, now }),
      ),
    ).toBe(422);
    expect(memberCount(otherUserId)).toBe(0);
  });

  test("別Workspaceの招待IDは404", async () => {
    const issued = await invite();
    expect(
      await status(
        revokeInvitation(db, userId, "0190a000-0000-7000-8000-000000000012", issued.invitation.id),
      ),
    ).toBe(403);
  });
});

describe("招待の受諾", () => {
  test("受諾の記録に失敗したらMembershipもロールバックする", async () => {
    const options: { failOn?: RegExp } = {};
    const local = createTestDb(options);
    seedTestDb(local.sqlite);
    const issued = await createInvitation(
      local.db,
      userId,
      workspaceId,
      { email: "other@example.com" },
      { mailer, now },
    );
    options.failOn = /update "invitations"/;
    await expect(
      acceptInvitation(local.db, otherUserId, tokenOf(issued.inviteUrl), { now }),
    ).rejects.toThrow();
    expect(
      local.sqlite
        .prepare("SELECT count(*) AS n FROM memberships WHERE workspace_id = ? AND user_id = ?")
        .get(workspaceId, otherUserId),
    ).toMatchObject({ n: 0 });
    expect(
      (await getInvitationPreview(local.db, otherUserId, tokenOf(issued.inviteUrl), { now }))
        .status,
    ).toBe("pending");
  });

  test.each(["revoke", "resend"])(
    "受諾直前の%sで無効になった招待はメンバーを作らない",
    async (action) => {
      const issued = await invite();
      const batch = db.batch.bind(db);
      const interleaved = vi.spyOn(db, "batch").mockImplementationOnce(async (queries) => {
        if (action === "revoke")
          await revokeInvitation(db, userId, workspaceId, issued.invitation.id, { now });
        else await resendInvitation(db, userId, workspaceId, issued.invitation.id, { mailer, now });
        return batch(queries);
      });
      try {
        await expect(
          acceptInvitation(db, otherUserId, tokenOf(issued.inviteUrl), { now }),
        ).rejects.toMatchObject({ status: action === "revoke" ? 422 : 404 });
        expect(memberCount(otherUserId)).toBe(0);
      } finally {
        interleaved.mockRestore();
      }
    },
  );

  test("同時受諾は片方が再受諾となりMembershipを重複させない", async () => {
    const issued = await invite();
    const token = tokenOf(issued.inviteUrl);
    const batch = db.batch.bind(db);
    const interleaved = vi.spyOn(db, "batch").mockImplementationOnce(async (queries) => {
      await acceptInvitation(db, otherUserId, token, { now });
      return batch(queries);
    });
    try {
      expect(await acceptInvitation(db, otherUserId, token, { now })).toMatchObject({
        alreadyMember: true,
      });
      expect(memberCount(otherUserId)).toBe(1);
    } finally {
      interleaved.mockRestore();
    }
  });

  test("招待先本人が受諾するとメンバーになり、共有メンバーとして一覧に出る", async () => {
    const issued = await invite("other@example.com", userId, { role: "admin" });
    const token = tokenOf(issued.inviteUrl);
    const preview = await getInvitationPreview(db, otherUserId, token, { now });
    parseResponse(GetInvitationPreviewResponse, preview);
    expect(preview).toMatchObject({
      workspaceName: "開発用",
      status: "pending",
      emailMatches: true,
    });

    expect(await acceptInvitation(db, otherUserId, token, { now })).toEqual({
      workspaceId,
      alreadyMember: false,
    });
    const members = await listWorkspaceMembers(db, otherUserId, workspaceId);
    expect(members.find((m) => m.user.id === otherUserId)?.role).toBe("admin");
    expect((await listInvitations(db, userId, workspaceId, { now }))[0]?.status).toBe("accepted");
  });

  test("再受諾してもMembershipは重複せず成功する。別のユーザーは使えない", async () => {
    const issued = await invite();
    const token = tokenOf(issued.inviteUrl);
    await acceptInvitation(db, otherUserId, token, { now });
    expect(await acceptInvitation(db, otherUserId, token, { now })).toEqual({
      workspaceId,
      alreadyMember: true,
    });
    expect(memberCount(otherUserId)).toBe(1);
  });

  test("メールアドレスが一致しないログインでは参加できず、概要でも本人でないと分かる", async () => {
    const issued = await invite("someone@example.com");
    const token = tokenOf(issued.inviteUrl);
    expect(await status(acceptInvitation(db, otherUserId, token, { now }))).toBe(403);
    expect(await status(acceptInvitation(db, userId, token, { now }))).toBe(403);
    expect((await getInvitationPreview(db, otherUserId, token, { now })).emailMatches).toBe(false);
    expect(memberCount(otherUserId)).toBe(0);
  });

  test("期限切れの招待は受諾できず、理由が分かる。再送すれば受諾できる", async () => {
    const issued = await invite();
    const token = tokenOf(issued.inviteUrl);
    expect(await reasons(acceptInvitation(db, otherUserId, token, { now: later }))).toEqual([
      "この招待は有効期限が切れています",
    ]);
    expect((await getInvitationPreview(db, otherUserId, token, { now: later })).status).toBe(
      "expired",
    );

    const resent = await resendInvitation(db, userId, workspaceId, issued.invitation.id, {
      mailer,
      now: later,
    });
    await acceptInvitation(db, otherUserId, tokenOf(resent.inviteUrl), { now: later });
    expect(memberCount(otherUserId)).toBe(1);
  });

  test("存在しないトークンは404", async () => {
    expect(await status(acceptInvitation(db, otherUserId, "x".repeat(43)))).toBe(404);
  });
});
