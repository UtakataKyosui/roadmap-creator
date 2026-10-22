# preview / prod の環境分離案

2026-10-23時点では環境の分離は未実施で、環境別の確定設定ファイルも存在しない。
今後はPR単位の `preview` と、本番用の `prod` を用意する。stagingは追加しない。
これはレビュー用の提案であり、資源作成・既存環境の本番指定・配備の承認ではない。

| 項目                  | prod（提案）                                  | preview（提案）                                        |
| --------------------- | --------------------------------------------- | ------------------------------------------------------ |
| Cloudflare account ID | `a5fe722b1d3ed1cb2dd9665abafcd39e`            | 同じアカウント、専用Worker・D1で分離                   |
| Worker名              | `roadmapper-prod`（新規）                     | `rm-<repository-id>-pr-<number>`（PRごとに新規）       |
| D1名                  | `roadmapper-prod-db`（新規）                  | `rm-<repository-id>-pr-<number>-db`（PRごとに新規）    |
| D1 ID                 | 作成後に記録                                  | 作成後に記録                                           |
| HTTPS origin          | workers.devサブドメイン確認後に確定           | 同サブドメイン確認後、PRごとに確定                     |
| GitHub Environment    | `prod`（新規）                                | `preview`（新規）                                      |
| 設定保存先            | `deploy/prod/{void.config.ts,void.lock.json}` | `deploy/previews/pr-<number>/`                         |
| 認証・データ          | 本番専用OAuth・secret・DB                     | preview専用OAuth・secret・DB、本番データをコピーしない |

既存Worker `tanstack-start-example-basic` とD1 `tanstack-start-example-basic-db`
（ID `d5548b00-e360-48ac-9629-35f00cffccfa`）は用途未分類のまま保全する。
この案ではそれらをprodに流用せず、削除もしない。

## 外部変更前に提示する内容

1. workers.devサブドメインと利用可能なWorker名を読み取りで確認し、正確なoriginを記録する。
2. 作成するWorker・D1、Accessの対象ホスト・許可対象、OAuthリダイレクトURI、
   GitHub Environmentの変数名・承認設定、実行コマンドを提示する。秘密値は記録しない。
3. ユーザーの承認後にだけ資源作成・外部設定・配備を実行し、確定IDと検証結果を記録する。

実設定とlockが揃うまではworkflowは配備を拒否する。
実行手順・必要なSecretsの名前・検証項目は [配備手順](../docs/deployment.md) を参照。
#39のstaging検証は、この構成ではpreviewでの非本番検証に置き換える案とし、
実環境検証を終えるまで#39・#40を完了扱いにしない。
