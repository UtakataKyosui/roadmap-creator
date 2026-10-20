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
