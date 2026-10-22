# Void secret sync が成功表示でも反映されない問題

調査日: 2026-10-22

## 症状

- `pnpm void secret sync .env` が `Synced 4 secrets.` と表示された。
- 続けて `pnpm exec void secret list` を実行すると `No secrets set.` となった。
- 調査時、本番の `/api/auth/ok` は 503「認証が設定されていません」を返した。

対象は Void 1.1.11、内部で使用する cf は 1.0.0-beta.18。

## 確認できた不具合

インストール済みの Void の一括登録処理と cf の受信処理を照合したところ、送信する JSON の形式に不一致があった。

cf が期待するリクエスト本文は、Secret のマップを `secrets` フィールドに入れる形式。

```json
{
  "secrets": {
    "GOOGLE_CLIENT_SECRET": {
      "type": "secret_text",
      "text": "<placeholder>"
    }
  }
}
```

一方、Void は外側の `secrets` を付けず、以下の形式をファイルに書いて `cf workers secrets bulk --file` に渡している。

```json
{
  "GOOGLE_CLIENT_SECRET": {
    "type": "secret_text",
    "text": "<placeholder>"
  }
}
```

cf の `--file` 処理は、このファイルをそのまま `/workers/scripts/{worker}/secrets-bulk` に PATCH する。`secrets` で包み直す処理はない。

さらに Void は処理の正常終了後、登録件数を読み戻して検証することなく、入力ファイルの件数を使って `Synced 4 secrets.` と表示する。

この形式不一致は「成功表示でも一覧が空」という症状を説明する。ただし、実際の API リクエスト・レスポンスの採取や、修正後の本番登録による再現確認は行っていない。

## 調査根拠

以下は調査時のインストール済みパッケージ内のファイル。ファイル名のハッシュはバージョンによって変わる。

- `node_modules/void/dist/cli/cloudflare-operation-process.mjs`: `secret.bulk` が `JSON.stringify(patch)` を `--file` に渡す。
- `node_modules/void/dist/secret-CClHaFxm.mjs`: `backend.sync(secrets)` の後、入力件数を成功メッセージに使用する。
- `node_modules/void/dist/cloudflare-operations-DH3GedbV.mjs`: `sync` と `list` は共通の Cloudflare operation context を使用する。
- `node_modules/.pnpm/cf@1.0.0-beta.18_@types+node@22.20.5/node_modules/cf/dist/workers-pP5tsDbD.mjs`: `workers secrets bulk` の JSON 構造と `--file` の送信処理。

## 以前の仮説の訂正

当初は Worker 名の不一致を疑ったが、調査時の `void.lock.json` と `.void-wrangler.jsonc` の Worker 名は、ともに `tanstack-start-example-basic` だった。`sync` と `list` も同じ設定解決処理を使うため、Worker 名の違いを原因とする根拠は得られていない。

また、`void env check --remote` の成功だけでは今回の Secret の存在を確認できない。認証用の3項目は `env.ts` で optional、`API_ORIGIN` はデフォルト値付きのため。

## 回避策と未実施事項

一括の `sync` を避け、以下を対話型ターミナルで実行して1件ずつ登録する。値はコマンド引数に書かず、非表示の入力プロンプトに入力する。

```sh
pnpm exec void secret put API_ORIGIN
pnpm exec void secret put BETTER_AUTH_SECRET
pnpm exec void secret put GOOGLE_CLIENT_ID
pnpm exec void secret put GOOGLE_CLIENT_SECRET
pnpm exec void secret list
```

`put` は一括登録とは別処理で、`name`、`text`、`type` を含む本文を送る実装であることを確認した。ただし、この回避策による本番への書き込みと動作確認は未実施。

本番の `API_ORIGIN` には本番 URL を指定する。ローカル用 `.env` の localhost 値をそのまま本番へ同期しない。

登録後は一覧に4件が現れることと、認証 API の応答を確認する。この記録の作成に伴う本番変更、依存パッケージの修正・更新は行っていない。
