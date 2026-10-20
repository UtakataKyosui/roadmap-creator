import { describe, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { devFixtures } from "../../db/dev-fixtures";
import { labels, roadmaps } from "../../db/schema";
import { resolveActorId } from "./auth";
import { HttpError, parseInput, toErrorResponse, toPointer } from "./errors";
import { handle, readJson } from "./http";
import { isUuid, uuidv7 } from "./ids";
import { createTestDb, seedTestDb } from "./testing/test-db";

describe("uuidv7", () => {
  test("バージョン7・RFC 4122のバリアントで、生成した順に昇順で並ぶ", () => {
    const ids = [1_000, 2_000, 3_000].map((t) => uuidv7(t));
    for (const id of ids) {
      expect(isUuid(id)).toBe(true);
      expect(id[14]).toBe("7");
      expect("89ab").toContain(id[19]);
    }
    expect([...ids].sort()).toEqual(ids);
  });

  test("先頭48bitにミリ秒の時刻が入る", () => {
    const timestamp = Date.UTC(2026, 0, 1);
    const hex = uuidv7(timestamp).replaceAll("-", "").slice(0, 12);
    expect(Number.parseInt(hex, 16)).toBe(timestamp);
  });

  test("UUIDでない文字列を判定できる", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("エラー応答", () => {
  test("JSONポインタへ変換し、特殊文字をエスケープする", () => {
    expect(toPointer(["dueDate"])).toBe("/dueDate");
    expect(toPointer(["labelIds", 0])).toBe("/labelIds/0");
    expect(toPointer(["a/b", "c~d"])).toBe("/a~1b/c~0d");
    expect(toPointer([])).toBe("");
  });

  test("入力検証の失敗を422とdetailsに変換する", async () => {
    const schema = z.object({ title: z.string().min(1) });
    let caught: unknown;
    try {
      parseInput(schema, { title: "" });
    } catch (error) {
      caught = error;
    }
    const response = toErrorResponse(caught);
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; details?: unknown };
    expect(body.code).toBe("validation_failed");
    expect(body.details).toEqual([{ path: "/title", message: expect.any(String) }]);
  });

  test("想定外の例外は内部情報を含まない500になる", async () => {
    const response = toErrorResponse(new Error("SQLITE_ERROR: secret detail"));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { code: string; details?: unknown };
    expect(body.code).toBe("internal");
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  test("handleはHttpErrorをそのステータスで返す", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "x");
    });
    expect(response.status).toBe(404);
  });

  test("不正なJSON本文は422になる", async () => {
    const request = new Request("http://x.test", { method: "POST", body: "{" });
    await expect(readJson(request)).rejects.toMatchObject({ status: 422 });
  });
});

describe("開発用ユーザー", () => {
  test("開発ビルドでは開発用ユーザーになる", () => {
    expect(resolveActorId(true)).toBe(devFixtures.userId);
  });

  test("本番ビルドでは未認証（401）になる", () => {
    expect(() => resolveActorId(false)).toThrowError(HttpError);
    expect(() => resolveActorId(false)).toThrowError(expect.objectContaining({ status: 401 }));
  });
});

describe("テスト用DB", () => {
  test("マイグレーションが適用され、外部キーが有効", () => {
    const { sqlite } = createTestDb();
    seedTestDb(sqlite);
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO memberships (id,workspace_id,user_id,role,created_at,updated_at) VALUES ('m','nope',?,'owner','t','t')",
        )
        .run(devFixtures.userId),
    ).toThrow();
  });

  test("開発用のロードマップとラベルが入り、該当なしの検索は空配列になる", async () => {
    const { db, sqlite } = createTestDb();
    seedTestDb(sqlite);
    const found = await db.select().from(roadmaps).where(eq(roadmaps.id, devFixtures.roadmapId));
    expect(found).toHaveLength(1);
    expect(await db.select().from(labels).where(eq(labels.id, devFixtures.labelId))).toHaveLength(
      1,
    );
    expect(await db.select().from(roadmaps).where(eq(roadmaps.id, "missing"))).toEqual([]);
    const [one] = await db.select().from(roadmaps).where(eq(roadmaps.id, "missing")).limit(1);
    expect(one).toBeUndefined();
  });
});
