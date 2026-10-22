# 配備とCI/CD（#19・#20）

## 担当とバージョン

Void 1.1.12 が Cloudflare Workers のアプリ、D1、binding、マイグレーション、配備履歴を管理する。
`cf` で同じWorker・D1を重複管理しない。Cloudflare AccessのポリシーやGitHub Environmentは管理者が別途設定する。
ローカルの同梱資料 `node_modules/void/docs/guide/deployment.md`、
`integrations/cloudflare.md`、`reference/cli/deploy.md` と `vp run void deploy --help` でコマンドを確認した。
Nodeは `.node-version`、pnpmは `package.json`、Void・Vite+はlockfileに固定する。

## 環境の分離

現在のルート設定のWorker名は `tanstack-start-example-basic`。既存の配備IDやDBを流用・変更しない。
Voidの直接Cloudflare配備は名前付き環境（`--env`）をサポートしない。
stagingとproductionそれぞれに独立したWorker、D1、API_ORIGIN、Access保護を用意し、
レビュー済みの `void.config.ts` と初回配備で得た `void.lock.json` を `deploy/<environment>/` に記録する。
環境別の設定・lockがない状態では手動CDも失敗する。

| 環境       | 配備単位           | URL・DB                                                     |
| ---------- | ------------------ | ----------------------------------------------------------- |
| ローカル   | `vp run dev`       | localhost:3000、ローカルD1                                  |
| staging    | 独立した検証Worker | 管理者が確定するHTTPS originと専用D1。Access必須            |
| production | 承認済みWorker     | 管理者が確定するHTTPS originと専用D1。本番OAuth検証後に公開 |
| PR preview | PR専用Worker       | `rm-<repository-id>-pr-<number>`、専用D1、Access保護        |

PRプレビューの作成・配備・削除は後述の承認手順で行う。設定未完了の状態では配備しない。

## 初回セットアップ（管理者の承認後）

1. `vp install --frozen-lockfile`、`vp run void prepare`、`vp run verify`。
2. 対象環境専用のチェックアウトで `vp run void connect --platform cloudflare`。
3. 環境別のWorker名とアカウント、Accessの対象ホスト・サービス認証を確定する。
   同一Worker/DBをstagingとproductionで共有しない。設定のD1 bindingとlockをレビューする。
4. `vp run void secret put API_ORIGIN` でその環境のHTTPS originを入力する。ローカル`.env`は配備されない。
5. `vp run db:generate` でSQLを生成・レビューしてリポジトリに記録する。
6. 初回配備を明示的に承認し、Access保護の設定を確認してから `vp run void:deploy`。
   Voidが未適用マイグレーションを適用して配備する。出力のURLとWorker versionを保存する。
7. 初回配備で確定した設定とlockを `deploy/staging/` または `deploy/production/` に記録する。
   ローカルの認証状態や `.void/` キャッシュは記録しない。

開発用ユーザーは開発ビルドに限定され、配備ビルドの匿名APIは401になる。
Accessを通過してもseedユーザーは有効にならない。#13のGoogle認証設定を各環境に用意する。
認証回避のために `import.meta.env.DEV` を配備で有効化しない。

## CI

`Quality` は全PRとmainで、固定バージョン・frozen lockfileの依存導入、Void型生成、
`vp check`、OpenAPI lint、Orvalの生成差分、実DBを使うテスト、型検査を含むビルドを実行する。
テストが0件なら失敗する。CIにCloudflare等の秘密情報は渡さない。
PRでは同じ参照の古い実行を取り消す（mainと配備からの呼び出しは取り消さない）。
`Workflow lint` が `.github/workflows/` の変更をactionlintで検査する。
使用するActionはコミットSHAで固定し、Dependabotが週次で更新PRを作る（Actions・npm）。

## 手動CD

`Deploy approved main commit` は書き込み権限者の `workflow_dispatch` 専用。
mainのコミットを選び、環境とマイグレーションを含むリリース承認を明示する。
品質チェック成功後、Environmentの認可を受け、現在のmainと一致するコミットだけを配備する。
GitHub Environmentが利用プランで承認者をサポートする場合はrequired reviewersとmain限定を設定する。
利用できない場合も、権限者による手動実行と承認入力が必須になる。
Environment変数は初期設定後に管理者が有効化する。自動で設定を変更する処理はない。

各EnvironmentのVariables:

- `DEPLOYMENT_READY=true`: 独立設定・lock・D1をレビュー済み。
- `ACCESS_READY=true`: URLとバージョンURLのアクセス制限を検証済み。
- `AUTH_READY=true`: productionのみ。Googleログイン（#13）の本番OAuth設定と認証テストを確認済み。
- `APP_URL`: クエリや認証情報を含まないHTTPS origin。
- `CLOUDFLARE_ACCOUNT_ID`、必要時 `CLOUDFLARE_WORKERS_SUBDOMAIN`。

`void.config.ts` の `cloudflare` にはlockの `resolved` と同じ明示的なWorker名、アカウント、
`DB` binding（専用D1の名前とID）、`migrations_dir: "./db/migrations"` を記録する。
`cloudflare.vars.API_ORIGIN` は `APP_URL` と同じHTTPS originにし、`worker.vars` で上書きしない。
`preview_urls: false` とし、未保護のバージョンURLを公開しない。バージョン確認にはmetadata bindingを使う。
配備前にルートの既存lock・staging・production・全PRのlockと照合し、WorkerやD1の共有を拒否する。

Secrets:

- `CLOUDFLARE_API_TOKEN`: 対象アカウントのWorkers Scripts編集、D1等利用資源の読取・必要な作成更新権限。
- `CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET`: readiness/ヘルス確認用サービス認証。

Workerには `API_ORIGIN` に加えて、環境専用の `BETTER_AUTH_SECRET`、`GOOGLE_CLIENT_ID`、
`GOOGLE_CLIENT_SECRET` をVoidで設定する。Googleの承認済みリダイレクトURIは
`<APP_URL>/api/auth/callback/google`。これらの値をGitや配備記録に保存しない。

productionとstagingは別SecretsとDBを使う。秘密値をコード・Issue・ログに書かない。
forkのPRを `pull_request_target` で配備しない。
同一環境はconcurrencyで直列化し、実行中ジョブをキャンセルしない。
古いmainからの配備は拒否する。失敗時はGitHubのジョブ結果を確認し、再実行前に配備状態を見る。

## 確認、障害、切り戻し

`vp run void project status` でactive version、`vp run void project logs` でログを確認する。
配備後はAccessのサービス認証付きで `/__void/ready` の200と匿名 `/api/workspaces` の401を確認する。
ログイン画面をヘルス成功と誤認しない。認証導入後は認証済み画面/APIのsmokeテストを追加する。
CDはサービス認証なしのreadinessがAccessで遮断されることも確認する。
ジョブサマリーに環境・コミット・URL・Worker versionとマイグレーション数を記録する。

失敗時は既存のactive versionを確認する。マイグレーションは配備前に適用されうるため、
アプリ失敗後もDBが更新済みの可能性がある。DBをリセット・seedせず、追加修正か前進マイグレーションを選ぶ。
旧コードと現行DBの互換性を確認した後、承認を受けて
`vp run void project rollback <previous-version>`。アプリの切り戻しはDBを復元しない。

## PRプレビュー（#40）

`Approved PR preview` はmainからの `workflow_dispatch` のみで動作する。
書き込み権限者がPR番号とレビュー済みの完全なhead SHAを入力し、配備とマイグレーションを承認する。
fork PRは配備しない。`pull_request_target` は使わず、品質ジョブには配備Secretsを渡さない。
`preview` GitHub Environmentにrequired reviewers（対応プランの場合）、main限定、
`DEPLOYMENT_READY`、`ACCESS_READY`、アカウントID、workers.devサブドメイン、専用の配備・Access Secretsを設定する。

1. 管理者がプレビュー用アカウント（既存と同一でも専用資源必須）、workers.devサブドメインと
   `rm-<repository-id>-pr-<number>.<subdomain>.workers.dev` のAccess保護を確定する。
   この名前空間を他の用途に使わない。人のGoogleログイン用Accessポリシーとサービス認証を用意する。
2. **承認後にのみ**、レビュー済みmainのチェックアウトで `node scripts/provision-preview.mjs` を実行する。
   必須の非秘密環境変数は `GITHUB_REPOSITORY`、`GITHUB_REPOSITORY_ID`、`PR_NUMBER`、
   `DEPLOY_SHA`（レビュー済みhead SHA）、`DEPLOY_ACTOR`（承認した書き込み権限者）、
   `PREVIEW_ACTION=deploy`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_WORKERS_SUBDOMAIN`、
   `PREVIEW_APPROVED=true`、`ACCESS_READY=true`。`GH_TOKEN` と `CLOUDFLARE_API_TOKEN` は安全な認証手段で渡す。
   既存Worker・DBは引き継がず、専用D1を新規作成する。Workerはまだ配備しない。
3. 出力された `deploy/previews/pr-<number>/{ownership.json,void.config.ts,void.lock.json}` をレビューしmainへ記録する。
   名前だけからDBの所有権を推測しない。作成途中で中断した場合はCloudflare上のIDを管理者が照合し、
   記録を復旧する。既存DBを自動削除・再利用して再試行しない。
4. プレビュー専用OAuthクライアントとセッションsecretを用意する。staging/productionの認証情報やseedを使わない。
   新規Workerへのsecret設定とAccess保護を管理者が確認するまで `DEPLOYMENT_READY` を有効にしない。
5. `Approved PR preview` をmainから `action=deploy`、PR番号、完全なSHA、承認入力で実行する。
   品質チェックが通ったSHAだけを配備する。設定・所有権記録・制御スクリプトはmainのものを使い、PRによる差し替えを防ぐ。
   Environment承認待ちやビルド中にPRが更新・終了した場合は、マイグレーション直前の再確認で古い実行を拒否する。
   すでに開始したマイグレーションはキャンセルしない。同一PRの更新・削除は直列化される。
6. PR番号・head SHA・URL・Worker version・マイグレーション数をサマリーとVoidの配備ログで対応づける。
   readiness、匿名API、Googleログイン後のWorkspace→Project→Roadmap画面/APIを確認する。
7. PR終了後、同じworkflowを `action=cleanup`、PR番号、**永久削除の承認**で実行する。
   自動のcloseイベントには削除権限を渡さない。main上の所有権記録、実際のDB ID/名前、Workerのbinding、
   他WorkerからのDB参照がないことを検証してからWorker→D1の順に削除する。
   404は削除済みとして再実行可能だが、権限不足・binding変更・共有参照がある場合は削除を拒否する。
   共有のAccessポリシーは残す。全資源の削除成功後にだけ所有権記録をmainから取り除く。

資源作成・削除にはVoidが管理する既存資源を移行しない専用スクリプトを使う。
直接Cloudflare配備の `void project delete` は非対応のため使用しない。
APIの参照: [D1作成](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/)、
[Worker設定取得](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/get/)、
[Worker削除](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/delete/)。

## 実環境検証の記録（#39・#40）

秘密値を含めず、対象環境の設定ディレクトリに検証結果を記録する。未実施項目は成功として扱わない。

- 承認者、実施日時、GitHub Actionsのrun URL、対象コミット、PR番号（preview時）
- アカウントID、Worker名、URL、専用D1 ID、配備前/後のWorker version、適用マイグレーション
- Access匿名遮断、サービス認証readiness 200、匿名API 401、認証済み主要画面/API
- ヘルス確認を意図的に失敗させた実行での検知結果と、互換性を確認した旧版への切り戻し結果
- previewの更新、古いSHAの拒否、PR終了後の削除、削除再実行と共有資源の保持

既存のルート設定はアカウント `a5fe722b1d3ed1cb2dd9665abafcd39e`、
Worker `tanstack-start-example-basic`、D1 `tanstack-start-example-basic-db`
（`d5548b00-e360-48ac-9629-35f00cffccfa`）。これは環境別設定ではないため、そのまま複製しない。
2026-10-23の読み取り確認ではGitHub Environmentは `copilot` のみで、配備用Repository Variablesは未登録。
この情報だけではstaging/productionへの割当やHTTPS originは確定できない。

## PWA（Service Worker）

`public/` のファイルはそのまま配信される（`public/` 配下は常時再検証、ハッシュ付き `/assets/*` のみ長期キャッシュ）。
`public/sw.js` は本番ビルドでのみ `src/pwa/register.ts` から登録する（スコープ `/`）。
Workers Assetsは `.html` 付きURLをリダイレクトするため、オフライン画面は `/offline`（`public/offline.html`）で参照する。

- キャッシュしない: `/api/**`、非GET、HTML（セッション状態を含むため）。ページ遷移はネットワーク優先で、失敗時のみ `/offline` を返す。
- cache-first: `/assets/*`（ハッシュ付き）。stale-while-revalidate: アイコン。
- 更新: キャッシュ内容を変える変更では `public/sw.js` の `VERSION` を上げる。activate時に旧キャッシュを削除し、`skipWaiting`/`clients.claim` で即時に切り替わる。
- 判定ロジック `classifyRequest` は `src/pwa/sw.test.ts` で検証する。
- maskableアイコンは、現行の丸型アイコンが安全領域を満たさないため未対応。

## 未検証の前提

対象URL・環境別D1 ID・Accessポリシー・GitHub Environmentの承認設定・Secretsは未設定。
この変更ではリモート資源の作成、配備、本番変更を行っていない。
それらのセットアップ後、非本番配備・失敗時の検知・認証済み主要画面の疎通を検証して#19・#20を完了する。
