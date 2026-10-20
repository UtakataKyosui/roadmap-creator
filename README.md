# roadmap-creator

+自分や知り合いが学習を行うためのRoadmapを作成するためのWebアプリケーション

## バックエンドとローカル開発

API サーバーは TanStack Start のサーバールート、DB は Cloudflare D1（Drizzle）。DB 選定の理由、ローカル起動、マイグレーション、seed の手順は [`docs/backend.md`](docs/backend.md) を参照。

## API 契約

API 契約の正本は [`openapi/openapi.yaml`](openapi/openapi.yaml)（OpenAPI 3.1）。型、Zod スキーマ、TanStack Query のクエリ／ミューテーションは、すべてこのファイルから [Orval](https://orval.dev) で生成する。API の型は手書きしない。

| コマンド            | 内容                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| `pnpm api:lint`     | 仕様を検証する（Redocly、設定は `redocly.yaml`）                            |
| `pnpm api:generate` | `src/api/generated/` を再生成する                                           |
| `pnpm api:check`    | 再生成して、コミット済みの生成物との差分がないことを確認する（CI でも実行） |

### 仕様を変更するとき

1. `openapi/openapi.yaml` を編集する
2. `pnpm api:lint` で仕様を検証する
3. `pnpm api:generate` で再生成し、生成物を仕様と同じコミットに含める

`src/api/generated/` は直接編集しない。生成物は Orval が書き出した後に `vp fmt` で整形されるため、再生成しても差分は出ない。

### 構成

| パス                           | 内容                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `src/api/generated/endpoints/` | タグごとの API クライアントと `useXxx` フック、`getXxxQueryKey`                                                          |
| `src/api/generated/models/`    | TypeScript の型                                                                                                          |
| `src/api/generated/zod/`       | Zod スキーマ                                                                                                             |
| `src/api/http.ts`              | 共通 HTTP 層（手書き）。Cookie の送信（SSR 時は受信した Cookie を転送）、サーバー側の絶対 URL 化、エラーの `ApiError` 化 |

### 規約

- 更新系の PATCH は部分更新。項目の省略は据え置き、`null` は未設定化を表す
- 更新は `version` で楽観ロックし、不一致は 409（`version_conflict`）を返す
- 一覧のうちタスクだけがカーソル式ページングを持つ
- エラーは共通の `Error`（`code` / `message` / `details`）で返す。画面は `code` で文言を決める
- QueryKey は生成される `getXxxQueryKey` を使う。URL に `workspaceId` と `roadmapId` が入るため、キーに自然に反映される
- サーバー側レンダリング時の API オリジンは環境変数 `API_ORIGIN`（既定 `http://localhost:3000`）で指定する。`env.ts` に宣言し `void/env` から読む（Worker 内では `process.env` に値が入らない）。本番は `void secret put API_ORIGIN` で設定する

### 画面からの使い方

- `src/api/query-client.ts`: QueryClient の生成。再試行するのはネットワーク失敗と 5xx のみ（2 回まで）。4xx、検証エラー、不正な JSON は再試行しない。更新系は再試行しない。`src/router.tsx` で生成し、TanStack Router の SSR 連携（`@tanstack/react-router-ssr-query`）で Provider とハイドレーションを設定している
- `src/api/validation.ts`: `parseResponse` で応答を Zod 検証し、契約違反は `ResponseValidationError` を投げる。生成クライアントには組み込まれていないため、呼び出し側が明示的に使う。`startDate <= dueDate` のような生成できない横断検証（作成は `CreateTaskInput`、部分更新は現在のタスクの日付を渡す `updateTaskInputFor(current)`）もここに置く（送信前にフォームで使う）
- `src/api/cache.ts`: 作成・更新・移動・削除後の `invalidateTasks`、ログアウト時の `clearUserCache`
