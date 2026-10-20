# バックエンド（API・DB）

API 契約の正本は [`openapi/openapi.yaml`](../openapi/openapi.yaml)。実装はこの契約に従う。

## 構成

| 項目           | 採用                                                 | 理由                                                                                          |
| -------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| API の実行方式 | TanStack Start のサーバールート（`src/routes/api/`） | 画面と同じ Worker で動き、OpenAPI の `servers` が指す `/api` と一致する。別サーバーを持たない |
| DB             | Cloudflare D1（SQLite）                              | Void の既定。ローカルの DB 初期化、マイグレーション、本番への適用を Void が管理する           |
| DB アクセス    | `void/db`（Drizzle ORM）                             | スキーマが TypeScript で型付けされ、マイグレーションを自動生成できる                          |

## ローカル開発

```sh
pnpm install
cp env.example .env
pnpm db:migrate   # マイグレーションを適用する
pnpm db:seed      # DB を初期化して開発用データを投入する
pnpm dev          # http://localhost:3000
```

| コマンド           | 内容                                                                           |
| ------------------ | ------------------------------------------------------------------------------ |
| `pnpm db:generate` | `db/schema.ts` の変更からマイグレーション SQL を生成する。生成物はコミットする |
| `pnpm db:migrate`  | 未適用のマイグレーションをローカル DB へ適用する（データは保持）               |
| `pnpm db:seed`     | ローカル DB を作り直し、マイグレーションと `db/seed.ts` を適用する             |

### 環境変数

`env.ts` に宣言し、`void/env` から読む。ローカルの値は `.env`（Git 管理外）に置く。Worker 内では `process.env` に `.env` の値が入らないため、`process.env` は使わない。

| 名前         | 既定値                  | 内容                              |
| ------------ | ----------------------- | --------------------------------- |
| `API_ORIGIN` | `http://localhost:3000` | SSR 中に API を呼ぶときのオリジン |

本番の値は `void secret put <NAME>` で設定する。

### 開発用データ

`db/seed.ts` が開発用ユーザー、Workspace、Project、Roadmap、Label を作る。ID は `db/dev-fixtures.ts` で固定している。

## API の実装

| 項目                                        | 場所                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| ルート（薄いアダプタ）                      | `src/routes/api/workspaces.*.ts`                         |
| サービス（業務ロジック。DB を引数で受ける） | `src/server/roadmaps.ts`, `src/server/tasks.ts`          |
| 共通処理（認可・エラー・ID・JSON 入出力）   | `src/server/access.ts`, `errors.ts`, `http.ts`, `ids.ts` |

OpenAPI 契約のすべての操作を実装している。Workspace・メンバー・ラベル・プロジェクトの一覧は `src/server/workspaces.ts`、タスクの削除は `src/server/tasks.ts`（紐づくコメントとラベルの紐づけは外部キーの連鎖削除で消える）。

### データの整合

親子の Workspace の一致、担当者がそのメンバーであること、ラベルが同じ Workspace に属することは、サービス層の検証に加えて複合外部キーでも守る（`(id, workspace_id)` の一意キーを参照する）。`task_labels` は `workspace_id` を持つ。担当者のメンバーシップを削除するには、先にそのタスクの担当を外す必要がある。

### 入力検証とエラー

- 入力は Orval が生成した Zod スキーマ（`src/api/generated/zod`）と `src/api/validation.ts` の横断検証で検証する。
- 検証エラーは 422 `validation_failed`。`details[].path` は JSON ポインタ（例 `/dueDate`）。
- 存在しない ID と UUID でない ID は 404、Workspace のメンバーでなければ 403、想定外の例外は内部情報を含まない 500 `internal`。

### 更新競合

更新は `version` を条件にした 1 文の `UPDATE ... WHERE id = ? AND version = ?` で行い、一致しなければ 409 `version_conflict`（対象が無ければ 404）。タスクのラベルの付け替えは D1 の `batch`（1 トランザクション）で、更新と同じ `version` 条件を付けて適用するため、競合時はラベルも変更されない。

### タスクの並び順

- `sortOrder` は fractional indexing のキー。作成時は同じ Roadmap・同じ status 列の末尾に採番する。
- `PATCH` で `beforeTaskId` / `afterTaskId` を送ると、移動先の列でその間に入る。`null` は先頭／末尾。片方を省略すると、省略した側は列内で隣接するタスクを境界にする。status だけ変えると移動先の列の末尾に入る。
- status と sortOrder は同じ `UPDATE` で更新する。移動先の列にないタスクや、順序が逆転した指定は 422。

### 一覧のページング

`nextCursor` は不透明な文字列で、中身は取得位置（offset）。ソート条件が変わると位置が変わるため、ページをまたぐ間は条件を変えない。取得の合間にタスクが追加・削除されると、項目の重複や欠落が起こり得る。

### 認証前の開発用動作

認証基盤（#13）の導入前は、開発ビルド（`import.meta.env.DEV`）に限り、すべてのリクエストを `db/dev-fixtures.ts` の開発用ユーザーとして扱う。本番ビルドでは常に 401 を返す。#13 では `src/server/auth.ts` の `resolveActorId` を、セッションから認証済みユーザーを取り出す処理に置き換える。

## テスト

```sh
pnpm test
```

サービス層のテストは、本番と同じ生成済みマイグレーションをメモリ上の SQLite（`node:sqlite`）に適用して実行する（`src/server/testing/test-db.ts`）。外部キーは有効で、`batch` は 1 つのトランザクションとして実行する。
