# PRプレビューとmain自動配備の設計

設計案・2026-10-23。実装、有効化、外部資源の作成は未実施。
#39・#40の後続設計として、preview/prodの2環境を対象にする。

## 結論と対象範囲

- PR作成・更新 → 品質確認 → 専用previewを自動作成・更新 → PR画面にURLを表示する。
- mainへのpush（PRマージを含む） → マージ後のコミットを品質確認 → prodへ自動配備する。
- PR終了 → 専用Worker・D1を自動削除する。更新・削除・配備は直列化する。
- 最初の外部設定・自動運用の有効化だけを承認対象にする。有効化後はPRごと、マージごとの追加承認を要求しない。
- previewは専用Cloudflareアカウントと専用OAuthクライアントを使う。prodの権限・データを渡さない。
- Googleログインを保つため、初期は固定URLのpreview枠を3個用意し、PRごとに1枠を専有させる。

固定枠は初期値の提案で、枠数は設定で変更できる。満杯なら待機と理由を表示し、既存PRを追い出さない。
PR存続中はURLとDBを維持し、終了・再利用時にはDBとセッションsecretを交換する。
全PRで無制限に異なるURLを作る方式は、OAuthコールバックを中継する仕組みが別途必要になるため採用しない。

## 現状と変更点

現在の `preview.yml` / `deploy.yml` は `workflow_dispatch` のみ。
`provision-preview.mjs` は管理者による作成と、PR別所有権ファイルのmainへの登録を前提とする。
`check-preview-pr.mjs` も人による承認者・完全head SHAの指定を要求している。
既存の仕組みに単にイベントを追加しても、自動運用にはならない。

| 項目           | 現状                    | 今回の設計                                         |
| -------------- | ----------------------- | -------------------------------------------------- |
| previewの起点  | 権限者の手動実行        | PRの作成・更新・reopen・draft解除後、Quality成功   |
| prodの起点     | mainから手動承認        | mainへのpush後、Quality成功                        |
| previewの名前  | PR番号を含む動的ホスト  | 固定slotホスト、PRと資源の対応は所有権台帳         |
| preview所有権  | GitへPRごとのJSONを登録 | 制御用D1へ記録し、PRコードから読み書きさせない     |
| preview削除    | 終了後に手動承認        | closed検出と定期照合。事前承認した専用資源だけ削除 |
| Cloudflare境界 | 同一アカウントも許容    | 自動previewはprodと別アカウントを必須にする        |
| 実行記録       | Actions summary         | summary・GitHub Deployment・所有権台帳             |

既存の手動手順は障害対応用に残すが、自動処理と同じロック・所有権検証を通す。
新旧の書き込み経路を別々に有効化しない。旧承認フラグを自動でtrueにして流用しない。
既存の未分類Worker/D1はこの設計でも移行・削除しない。

## イベントと実行フロー

### 1. Quality（秘密情報なし）

`api-contract.yml` の既存チェックを再利用する。
PRは `opened / synchronize / reopened / ready_for_review`、mainは `push` で開始する。
同一PRの古いQualityは取り消せる。draftはQualityのみで、preview資源は新規作成しない。

preview対象はPRの完全head SHAを明示して検証する。現在のPR既定checkoutのmerge refと混同しない。
mainではpushされた完全SHAを検証する。検証対象SHAを実行記録へ出す。
ブランチ保護で必要ならmerge refの統合検証も別途残し、その成功をhead SHA検証の代わりにはしない。

### 2. 配備コントローラー（main上の信頼済みコード）

新設 `automatic-deployment.yml` は `workflow_run` の `completed` で起動し、
対象workflowを `Quality` と新設 `Preview lifecycle` の2つに限定する。
同workflowに `schedule`（30分ごと）と手動の復旧用 `workflow_dispatch` を設ける。
全イベントで初期権限は `contents: read`。必要なjobにだけ権限を足す。

GitHub APIでrunのworkflow ID・repository・event・conclusion・対象SHAを確認する。
PR番号・URL・資源IDをPRのartifactやタイトルから信用して読み込まない。
PR runはAPIで対応するPRを解決し、同一repo・base main・open・非draft・最新head SHAを再検証する。
対応PRが0件/複数件で一意に決まらない場合は配備しない。
作成者と対象headの更新者がwrite/maintain/admin権限を持つことを確認する。
権限が失われていれば停止し、Dependabot等のbotも初期状態では対象外にする。
fork PRはQualityのみで、権限者が再実行しても秘密情報を渡さない。

main runは `event=push`、対象ブランチmain、conclusion successを確認する。
最新mainと一致しないSHAは配備せず、最新コミットのQuality完了を待つ。
`workflow_run` 側の `github.sha` は検証対象SHAとして使わない。

PR終了は `pull_request: closed` を受ける秘密情報なしの検知workflowからコントローラーへ繋ぐ。
検知workflow名は `Preview lifecycle` とする。検知runの成功だけで削除せず、APIで現在のPR状態を読む。
mainマージに伴うprod配備とpreview削除は別処理で、互いの成功を待たない。
削除されるのはpreview資源のみで、prodはpreviewの成果物やDBを流用しない。

### 3. checkoutとジョブの境界

制御スクリプト・環境定義はcontroller起動時のmain SHAに固定する。
そのSHAと配備対象SHAを両方記録する。PRの設定・scriptで所有権検証を置き換えさせない。
PRビルドは別の作業ディレクトリ、`persist-credentials: false`、GitHub-hostedの一時runnerで実行する。
制御・ビルド・配備・結果通知はjobを分け、書き込みGitHub tokenをPRコードへ渡さない。
preview/prodで書き込みキャッシュを共有せず、制御jobはPR由来のcacheを復元しない。

Void 1.1.12はWorkerアプリの `--skip-build` に対応していない。
したがって、秘密情報なしで作ったartifactをそのままVoidで公開する設計にはしない。
配備job内で再ビルドが起こり、PRコードがpreview用tokenを取得し得ることを信頼境界に含める。
step単位のenv指定やscriptをmainからコピーするだけでは、このリスクは除去できない。
自動対象を信頼するrepo書き込み権限者に限定し、previewアカウント全体を検証用途に限定する。
信頼できないPRの自動配備は対象外。将来対応には、資格情報を渡さない公開API/隔離された配備サービスが必要。

## 環境と権限

| 項目               | preview                                     | prod                                             |
| ------------------ | ------------------------------------------- | ------------------------------------------------ |
| GitHub Environment | `preview`                                   | `prod`                                           |
| Cloudflare account | 新設のpreview専用アカウント                 | 既知のアカウントを候補に、初回設定時に確定       |
| Worker             | `rm-<repo-id>-slot-01`〜`03`、1枠1PR        | `roadmapper-prod`（新規案）                      |
| D1                 | `rm-<repo-id>-pr-<number>-g<generation>-db` | `roadmapper-prod-db`（新規案）                   |
| URL                | slot Workerの固定workers.dev origin         | 初回設定時に確定するHTTPS origin                 |
| OAuth              | preview専用client、3枠のcallbackを事前登録  | 本番専用client、prod callbackのみ                |
| Access             | 全slotホストを初回に保護、version URL無効   | 当面Access保護を維持、version URL無効            |
| 設定               | `deploy/preview/slots.json`（非秘密）       | `deploy/prod/{void.config.ts,void.lock.json}`    |
| reviewer待ち       | 有効化後はなし                              | 有効化後はなし。mainのPRレビューを承認境界にする |

prodの公開サービス化、Access解除、カスタムドメイン追加は別変更として承認する。
Google callbackがAccessを通過することは、初回に実ブラウザで確認する。
previewの固定ホストはGoogleのredirect URI完全一致要件に合わせるための設計判断である。

共通Variablesは `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_WORKERS_SUBDOMAIN`、
`DEPLOYMENT_READY`、`ACCESS_READY`、`AUTH_READY`。prodには `APP_URL`、
previewにはslot設定と台帳の参照IDを追加する。
さらに `AUTO_PREVIEW_ENABLED` / `AUTO_PROD_ENABLED` を初期falseとし、停止スイッチにする。
GitHub Environmentのブランチ制限はmainとし、controllerとcheckout refの組合せを実機検証する。

Secretsは環境ごとに `CLOUDFLARE_API_TOKEN`、`CF_ACCESS_CLIENT_ID/SECRET`、
`GOOGLE_CLIENT_ID/SECRET` を分離する。Workerの `BETTER_AUTH_SECRET` は生成・世代交換する。
prodは既存設定を初回に登録し、毎回生成し直さない。ログ・artifact・台帳へ秘密値を書かない。
API_ORIGINは非秘密で、レビュー済みoriginと一致させる。

台帳はpreviewアカウントの専用D1に置き、PR Workerへbindingしない。
台帳とAccessを扱う資格情報は信頼済みcontroller jobだけで使用し、PR配備jobへ渡さない。
preview配備tokenは台帳D1への操作を許さない資源scopeを使う。
必要なWorkers/D1 APIごとにscopeの実効性を検証し、台帳が同tokenから操作可能なら自動化を有効にしない。
その場合は制御用アカウントへ台帳を分離する。名前の接頭辞やアプリ内チェックをIAM境界とはみなさない。
Accessの設定変更権限は定常配備tokenに付けず、初回管理者設定に限定する。

通知jobだけに `deployments: write` を付け、GitHub Deploymentとstatusのenvironment URLを更新する。
初期はPRコメントを投稿せず、PRのDeployment表示とActions summaryにリンク・SHA・状態を出す。
これによりPRコードを動かすjobに `pull-requests: write` を渡す必要がない。

## プレビューのライフサイクル

### 台帳と割当

台帳はrepository ID・PR番号・generation・slot・account・Worker名・DB ID/名・origin・
希望head SHA・稼働SHA・制御SHA・run ID・Worker version・migrations・状態・更新日時を持つ。
slotの一意制約と条件付き更新で二重割当を拒否する。
GitHub concurrencyに加え、台帳に所有runと期限付きleaseを持ち、停止runnerの復旧を判定する。
lease期限だけを理由に実行中のmigrationと並行処理を始めず、Actions run終了とCloudflare状態も確認する。

状態は `waiting → provisioning → deploying → ready`、終了時に `deleting → deleted`。
失敗は `failed`、所有権の不明な資源は `quarantined` とし、自動の再利用・削除を禁止する。
slot満杯は `waiting`。定期照合で古いPRから割当を試みる。

1. PRの現在状態・権限・最新成功SHAを検証する。更新済みなら資源を作らない。
2. 既存の割当があれば再利用する。なければ空slotを排他的に予約しgenerationを確定する。
3. D1作成前の意図を台帳へ書く。作成応答のDB IDを直ちに記録する。
   中断でDB IDが欠けた場合、同名DBを推測して採用せず隔離し、管理者が照合する。
4. 固定slotのAccess保護を確認し、DB binding、API_ORIGIN、version URL無効化を持つ設定/lockを生成する。
   無関係なroutes、service binding、追加DBをPRのconfigから継承しない。
5. 新しいWorkerへpreview専用OAuthと生成したsession secretを初回配備と整合する手順で登録する。
   Voidの新規Worker bootstrapとsecret設定順序を最初の非本番スパイクで検証し、公開の空白期間を作らない。
6. exact SHAを環境設定付きで検証し、migration直前にPR状態・head・台帳generationを再確認する。
7. Voidで配備・migration、ヘルス確認、versionとmigration記録を行う。
8. 最新generationかつ最新headの結果だけをreadyにする。途中更新があった場合は旧SHAの結果と明示し、次runへ引き継ぐ。

更新ではDBを維持する。migrationはforward-onlyを原則にし、履歴変更を拒否する。
DB初期化・seedは暗黙実行しない。PRの更新順序により過去schemaへ戻す必要が出たら失敗させ、
手動の「preview再作成」で新generation・新DBを作る。旧DB削除は所有権確認後に行う。

### 自動削除とreopen

closedをAPIで再確認して削除する。Worker名だけを所有権根拠にしない。
台帳generation、実WorkerのDB binding、実DB ID/名、別Workerからの参照なしを検証する。
参照列挙のページをすべて読み、403・列挙失敗・所有権不一致は削除を止める。
Worker → D1の順で削除し、それぞれの完了を台帳へ記録する。404は再実行可能な削除済みと扱う。
共有のAccess・OAuth・台帳は削除対象に含めない。全削除確認後にのみslotを空ける。

reopenはPRを再検証し、削除前ならロック解放後に既存generationを確認、削除済みなら新generationを割り当てる。
削除開始後のreopenでは削除を完了させてから再作成し、途中の資源を引き継がない。
slot再割当時は旧session secretとDBを再利用しない。

30分ごとの定期照合でclosedの残存資源、失敗中run、枠待ちPRを回収する。
長期間更新のないopen PRは初期案では自動削除せず、上限3枠で費用を制限する。

## 本番のライフサイクル

1. mainへのpushに対するQuality成功を検証する。PRのQuality成功だけでは代用しない。
2. prodの停止スイッチと設定/lock・origin・account・認証完了を確認する。
3. `deploy-prod` concurrencyで配備を直列化し、実行中runは取り消さない。
4. 対象SHAをcheckoutし、prod設定を適用して環境付きビルドを検証する。
5. migration直前に最新mainとの一致を再確認する。古ければskipし、最新runに委ねる。
6. 直前のactive versionとmigration情報を記録してから `void deploy --platform cloudflare` を実行する。
7. Accessサービス認証付きreadiness 200・匿名API 401、Accessなしの遮断を確認する。
8. 成功したSHA・URL・version・migration・run URLをDeploymentとsummaryに残す。

品質チェック中のrunは取り消しても、配備開始後のmigrationは自動で中断しない。
デプロイ直前確認と実API変更の間にmainが更新される競合を完全には排除できないため、
実行中の旧版配備は完了を記録し、最新mainを次に配備する。全中間コミットの配備は保証しない。
GitHubのpending runは置き換わり得るので、定期照合で最新mainの成功runと本番稼働SHAを比較し未配備を検出する。
一度失敗した同一SHAを定期処理で無限再試行せず、手動再実行または新SHAを待つ。

mainの直接pushを禁止し、required Quality・レビュー・workflow/configのCODEOWNERS確認を設定する。
この保護がない状態ではmainマージをリリース承認とみなさず、自動prodを有効にしない。
repoの利用プランで必要な保護が使えない場合は、prodのEnvironment承認を残す半自動運用に落とす。

## 障害と復旧

- build/Quality失敗：資源の公開・migrationに進まない。既存preview/prodを維持する。
- 資源作成途中失敗：台帳のstageを保持して照合する。所有者不明の同名DBを再利用・削除しない。
- 配備/ヘルス失敗：failedとして記録し、URLを成功表示しない。直前の稼働状態とDB適用状況を調査する。
- Void内部のreadiness/activation復旧と、配備後の独自ヘルス失敗を区別する。
  後者でDBを自動復元せず、コードとDBの互換性確認後に手動rollbackまたは修正配備を選ぶ。
- 削除途中失敗：資源ごとの完了状態を保持し、再実行可能にする。slotを先に再利用しない。
- 間違った自動配備の停止：`AUTO_*_ENABLED=false`。すでにmigration中なら自動cancelせず状態を確認する。
- 手動復旧：mainのcontrollerから対象PR/完全SHA/再作成・削除などの操作を指定し、同じロックと所有権検証を通す。

アプリログに加え、権限不足、古いSHA skip、枠待ち、cleanup失敗を別の結果として表示する。
CI用サービス認証が通ることとGoogleログイン成功は別の検証項目にする。
Googleログイン後のWorkspace→Project→Roadmapは初回と認証変更時に実ブラウザで確認する。

## 実装計画と受け入れ条件

| 順番 | 実装単位                  | 完了条件                                                                                    |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | 制御仕様・自動対象の検証  | fork、draft、bot、権限なし、別workflow、曖昧PR、古いSHAを拒否するテスト                     |
| 2    | 台帳・slot・資源管理      | 二重割当・lease・中断・再実行・列挙全ページ・共有資源保持・reopenのテスト                   |
| 3    | preview controller        | 信頼済みmainの制御、秘密なしQuality、初回作成と2回目更新、URL/status、枠待ち・自動cleanup   |
| 4    | prod controller           | main Quality成功SHAのみ、migration直前チェック、直列化、失敗検知、停止スイッチ              |
| 5    | 外部bootstrapの設定案提示 | account/ホスト/D1/Access/OAuth/Secrets名/権限/ブランチ保護/コマンドを非秘密の設定資料に確定 |
| 6    | 承認後のpreview実証       | Googleログイン、匿名遮断、readiness、認証済み画面、連続更新、closed/reopen、失敗後再実行    |
| 7    | 承認後のprod有効化        | 初回手動配備、失敗/rollback訓練、mainへの検証用マージで自動配備、最新SHAと稼働version照合   |

実装は3つのPRに分ける：台帳/検証とテスト、preview自動化、prod自動化。
最初の2つは自動スイッチfalseで導入し、preview実証後にprodへ進む。
YAMLはactionlint、スクリプトはAPIモックを使う副作用検証、全体は既存 `vp run verify` で検証する。
実Cloudflareの資源作成・削除は単体テストでは実行しない。

## 有効化前の確認事項

今は追加情報の提供や外部操作の承認は不要。実装時に読み取りで判明する値を先に埋める。
ユーザーには次の具体的な変更案をまとめて提示し、自動運用の範囲を含めて一度承認を求める。

- preview専用アカウント、prodアカウント、確定ホストと3枠の費用・上限。
- 新規Worker/D1・制御台帳の一覧、既存資源を保全する範囲。
- preview/prod OAuth clientとcallback、Access許可対象・サービス認証、秘密の登録先。
- GitHub Environments、branch protection、tokenの実効scopeと対象外資源へのアクセス拒否結果。
- 「信頼する同一repo PRで自動作成/更新/削除」「mainの成功SHAで自動prod」の有効化。

同一アカウント案を記載した `deploy/README.md` より、本設計の自動運用条件を優先する。
新しいaccount・slot・台帳・workflowはまだ存在しないため、本文の名前は提案であって確定IDではない。

## 参照資料

- [GitHub workflowイベント](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)：workflow_runの権限境界と起動条件。
- [GitHub concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency)：pending置換と配備の直列化。
- [Cloudflare API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)：scopeを限定した資格情報の発行。
- [Google OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server)：redirect URI完全一致要件。
- ローカルのVoid 1.1.12資料：`node_modules/void/docs/reference/cli/deploy.md`、`guide/deployment.md`、`integrations/cloudflare.md`。
- 現行手順：[deployment.md](./deployment.md)、初期案：[deploy/README.md](../deploy/README.md)。
