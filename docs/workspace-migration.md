# workspace 移行手順

## マージ順

1. CI #61、OGP #62、PWA #63、レスポンシブ #65 を先にマージする。#63 と #65 は safe-area 対応を組み合わせて確認する。
2. workspace の最下層 `refactor/workspace-api-contract` を更新後の main に rebase し、domain、ui の順にスタックを更新する。
3. 各層で `vp install --frozen-lockfile` と `vp run verify` を実行し、api-contract → domain → ui の順にマージする。

OGP と PWA は `src/routes/__root.tsx`、レスポンシブと UI 分離はコンポーネントの移動で競合する可能性がある。双方の変更を残す。移動表は `scripts/workspace-split.mjs` にあり、各層で `node scripts/workspace-split.mjs --layer api-contract --move --rewrite`（domain 層では `domain`、ui 層では `ui`）を使って新しい import を追従できる。競合そのものは先に解決し、実行後の差分を確認する。

## 構成と検証

- ルート: 画面、ルーティング、データ取得、サーバー、配備。Vite+ の `defaultPackage: "."` で開発とビルドの対象を固定する。
- api-contract: Orval の models と Zod。再生成後に import をパッケージ参照へ変換する。
- domain: 純粋関数と検証、isUuid。UUID の生成と時刻取得はサーバーに残す。
- ui: Button、React Flow 部品、TaskCard、Avatar、badges。router や API は持たない。

Tailwind の `source('../')` は src のみを探索するため、app.css に `@source "../../packages/ui/src"` を追加している。レスポンシブ PR を統合するときもこの行を残す。

各層で API 再生成差分ゼロ、190件以上のテスト、ビルドと型検査を確認する。最上層では生成 CSS に `.bg-clip-padding` があること、クライアントに `void/env` と `getRequestHeaders` がないこと、React が単一バージョンであることも確認する。

切り戻しは UI → domain → api-contract の逆順に revert する。DB・API の契約変更はない。
