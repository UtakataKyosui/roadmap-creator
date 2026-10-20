# roadmap-creator

+自分や知り合いが学習を行うためのRoadmapを作成するためのWebアプリケーション

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
- サーバー側レンダリング時の API オリジンは環境変数 `API_ORIGIN`（既定 `http://localhost:3000`）で指定する
