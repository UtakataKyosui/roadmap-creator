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

| 名前                   | 既定値                  | 内容                                                         |
| ---------------------- | ----------------------- | ------------------------------------------------------------ |
| `API_ORIGIN`           | `http://localhost:3000` | SSR 中に API を呼ぶときのオリジン。認証のベース URL も兼ねる |
| `BETTER_AUTH_SECRET`   | なし                    | セッション署名用の秘密鍵（32 文字以上）                      |
| `GOOGLE_CLIENT_ID`     | なし                    | Google OAuth クライアント ID                                 |
| `GOOGLE_CLIENT_SECRET` | なし                    | Google OAuth クライアントシークレット                        |

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

### マイタスク（`GET /me/tasks`）

実装は `src/server/my-tasks.ts`。ログイン中のユーザーが担当するタスクを、所属する Workspace をまたいで返す。

| 項目           | 内容                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 対象           | 担当者が本人、本人が Membership を持つ Workspace、アーカイブされていない Project・Roadmap のタスク。担当者を指定するパラメータはなく、送られても無視する |
| 基準日         | `today`（必須）。クライアントが利用者のタイムゾーンの今日を送り、期限の判定と集計で共通に使う                                                            |
| 検索・絞り込み | `q`（タイトル・説明）、`status`（複数は OR）、`due`（複数は OR）。異なる条件は AND                                                                       |
| 期限の判定     | `overdue`: 期限が `today` より前で未完了、`today`: 期限が `today`、`thisWeek`: `today` から 6 日後までで未完了、`noDueDate`: 期限なし                    |
| 並び           | `sort`（既定は期限の昇順）。期限なしは常に末尾。同値は `id` 昇順で、ページをまたいでも重複・欠落しない                                                   |
| ページング     | `page`（1 始まり）と `pageSize`（既定 20、最大 100）。`totalCount` は条件に一致する総数                                                                  |
| 集計           | `summary` は検索・絞り込みに影響されず、対象のタスク全体から算出する。進捗はサーバーで持たず、status から共通関数で算出する                              |

### 招待（`/workspaces/{id}/invitations`, `/invitations/{token}`）

実装は `src/server/invitations.ts`。

| 項目           | 内容                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 権限           | 作成・一覧・再送・取消は owner/admin だけ。メンバーは 403、メンバー以外も 403。受諾は招待先本人                                                                                             |
| 招待できる役割 | `admin` / `member`（既定 `member`）。owner は招待で付与しない                                                                                                                               |
| トークン       | 32 バイトの乱数。保存するのは SHA-256 のハッシュだけで、URL（`inviteUrl`）は作成・再送の応答でしか得られない                                                                                |
| 有効期限       | 7 日（`INVITATION_EXPIRY_DAYS`）。状態は列から算出する（`pending` / `accepted` / `revoked` / `expired`）                                                                                    |
| 重複           | 既にメンバーのメールアドレス、招待中のメールアドレスは 422。同じメールアドレスの招待中は部分一意インデックスで 1 件に限る（同時の作成も拒否する）。期限切れが残っていれば取り消して作り直す |
| 再送           | 新しいトークンに替えて期限を延ばす。以前の URL は使えなくなる。受諾済み・取消済みは 422                                                                                                     |
| 取消           | 招待中のみ。取消済みへの再実行は 204。受諾済み・期限切れは 422                                                                                                                              |
| 受諾           | ログイン中ユーザーのメールアドレスが招待先と一致しなければ 403（メールだけで既存ユーザーを統合しない）。取消・期限切れ・使用済みは 422 で理由を返す                                         |
| 再受諾         | 同じユーザーの再受諾は成功し、Membership を重複作成しない（`(workspace_id, user_id)` 一意 + `ON CONFLICT DO NOTHING`）                                                                      |

### 招待メール

送信は `Mailer`（`src/server/mailer.ts`）で差し替える。現在の `logMailer` は送信せず、開発ビルドに限り宛先と招待 URL をサーバーのログ（`[mail] ...`）に出す（招待 URL は秘密のため、本番のログには出さない）。ローカルでは、このログの URL か、招待作成の応答の `inviteUrl` を開いて受諾を確認する。メール送信に失敗しても招待は作られ、応答の `emailSent` が `false` になる。

### 認証済みユーザーの解決

`handle`（`src/server/http.ts`）が `resolveActorId`（`src/server/auth.ts`）を呼び、リクエストの Cookie からサーバーがセッションを検証してユーザー ID を得る。セッションがなければ 401。クライアントが認証済みと申告しても API は使えない。

認証の環境変数が未設定の開発ビルド（`import.meta.env.DEV`）に限り、`db/dev-fixtures.ts` の開発用ユーザーとして扱う。環境変数を設定すると開発ビルドでも実際のログインが必要になる。本番ビルドでは未設定でも開発用ユーザーにはならず、常に 401 を返す。

## 認証（Google ログイン）

| 項目           | 内容                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| ライブラリ     | [Better Auth](https://www.better-auth.com/)（Void の認証は framework mode 非対応のため直接利用する） |
| セッション     | データベースに保存し、署名付き Cookie で参照する                                                     |
| エンドポイント | `/api/auth/*`（`src/routes/api/auth.$.ts`）                                                          |
| 設定           | `src/server/better-auth.ts`（`env` はリクエスト内でしか読めないため、初回利用時に組み立てる）        |

### Google の設定

Google Cloud Console で OAuth クライアント（ウェブアプリケーション）を作り、承認済みのリダイレクト URI を登録する。

| 環境 | リダイレクト URI                                 |
| ---- | ------------------------------------------------ |
| 開発 | `http://localhost:3000/api/auth/callback/google` |
| 本番 | `${API_ORIGIN}/api/auth/callback/google`         |

開発の値は `.env`、本番は `void secret put BETTER_AUTH_SECRET` などで設定する。

### データ

認証テーブル（`auth_users` / `auth_sessions` / `auth_accounts` / `auth_verifications`）はアプリの `users` と別に持つ。認証ユーザーの作成時に、同じ ID でアプリの `users` を作る。

- ID は UUID v7。`auth_accounts` は `(provider_id, account_id)` が一意で、同じ Google アカウントの並行ログインでもユーザーが重複しない。
- メールアドレスだけで既存のユーザーに結びつけない（アカウントリンクは無効）。同じメールアドレスのアプリユーザーが既にいる場合、認証ユーザーの作成を拒否する。

### 画面側の動作

| 項目             | 動作                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| 未ログイン       | ルートの `beforeLoad` がサーバーでセッションを確認し、`/login?redirect=<元の画面>` へ送る                 |
| 戻り先           | `redirect` は同じオリジンの絶対パスだけを受け付け、それ以外は `/` にする（`src/domain/auth-redirect.ts`） |
| キャンセル・失敗 | 認証の失敗は `/login?error=<コード>` に戻り、アカウントは作られない。文言は画面側で決め、再試行できる     |
| ログアウト       | `signOut` の後に QueryClient のキャッシュを破棄して `/login` へ移る                                       |
| セッション失効   | 保護 API が 401 を返すとキャッシュを破棄し、現在の画面を戻り先にして `/login` へ移る                      |

## テスト

```sh
pnpm test
```

サービス層のテストは、本番と同じ生成済みマイグレーションをメモリ上の SQLite（`node:sqlite`）に適用して実行する（`src/server/testing/test-db.ts`）。外部キーは有効で、`batch` は 1 つのトランザクションとして実行する。
