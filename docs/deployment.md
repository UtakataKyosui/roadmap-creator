# 配備とCI/CD（#19・#20）

## 担当とバージョン

Void 1.1.11 が Cloudflare Workers のアプリ、D1、binding、マイグレーション、配備履歴を管理する。
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

| 環境       | 配備単位             | URL・DB                                                     |
| ---------- | -------------------- | ----------------------------------------------------------- |
| ローカル   | `vp run dev`         | localhost:3000、ローカルD1                                  |
| staging    | 独立した検証Worker   | 管理者が確定するHTTPS originと専用D1。Access必須            |
| production | 承認済みWorker       | 管理者が確定するHTTPS originと専用D1。#13完了まで公開しない |
| PR preview | 現段階では配備しない | forkに秘密情報を渡さず、レビュー後mainをstagingで確認する   |

PRごとのWorker/DBの作成・削除は、独立D1の割当とAccess保護の検証後に追加する。
現段階ではプレビュー資源を作らないのでPR終了時の削除対象はない。

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

現時点では開発用ユーザーは開発ビルドに限定され、配備ビルドのAPIは401になる。
Accessを通過してもseedユーザーは有効にならない。画面の実データ検証には#13の認証が必要。
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

Secrets:

- `CLOUDFLARE_API_TOKEN`: 対象アカウントのWorkers Scripts編集、D1等利用資源の読取・必要な作成更新権限。
- `CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET`: readiness/ヘルス確認用サービス認証。

productionとstagingは別SecretsとDBを使う。秘密値をコード・Issue・ログに書かない。
forkのPRを `pull_request_target` で配備しない。
同一環境はconcurrencyで直列化し、実行中ジョブをキャンセルしない。
古いmainからの配備は拒否する。失敗時はGitHubのジョブ結果を確認し、再実行前に配備状態を見る。

## 確認、障害、切り戻し

`vp run void project status` でactive version、`vp run void project logs` でログを確認する。
配備後はAccessのサービス認証付きで `/__void/ready` の200と匿名 `/api/workspaces` の401を確認する。
ログイン画面をヘルス成功と誤認しない。認証導入後は認証済み画面/APIのsmokeテストを追加する。
CDのジョブサマリーに環境・コミット・URLを記録し、Void出力のWorker versionもリリース記録に残す。

失敗時は既存のactive versionを確認する。マイグレーションは配備前に適用されうるため、
アプリ失敗後もDBが更新済みの可能性がある。DBをリセット・seedせず、追加修正か前進マイグレーションを選ぶ。
旧コードと現行DBの互換性を確認した後、承認を受けて
`vp run void project rollback <previous-version>`。アプリの切り戻しはDBを復元しない。

## 未検証の前提

対象URL・環境別D1 ID・Accessポリシー・GitHub Environmentの承認設定・Secretsは未設定。
この変更ではリモート資源の作成、配備、本番変更を行っていない。
それらのセットアップ後、非本番配備・失敗時の検知・認証済み主要画面の疎通を検証して#19・#20を完了する。
