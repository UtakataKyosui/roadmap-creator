# Issue・PRテンプレートの使い方

## Issueを選ぶ

GitHubの「New issue」で目的に合うテンプレートを選ぶ。テンプレートが選択画面に反映されるのは、デフォルトブランチへのマージ後。

| テンプレート                                                            | 用途                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| [機能追加・改善](../.github/ISSUE_TEMPLATE/feature.md)                  | ユーザーの課題、実装範囲、受け入れ条件を決める |
| [OpenPencilでのデザイン作成・変更](../.github/ISSUE_TEMPLATE/design.md) | AIへの依頼、デザインの成果物、採用判断を残す   |
| [不具合報告](../.github/ISSUE_TEMPLATE/bug.md)                          | 再現条件、期待動作、修正の完了条件を残す       |
| [技術改善・ドキュメント](../.github/ISSUE_TEMPLATE/maintenance.md)      | 開発環境、リファクタリング、文書などを改善する |

`AC-1` などのIDを受け入れ条件に付け、PRで同じIDの検証結果を記録する。条件を追加・変更した場合はIssueも更新する。不要な項目は「対象外: 理由」、未決定は「未決定: 判断する人・タイミング」と記載する。チェックは実際に完了したときだけ付け、対象外や未実施を合格扱いにしない。

## OpenPencil / MCPでデザインを決めて実装する

正本は [`designs/roadmap-studio.fig`](../designs/roadmap-studio.fig)。OpenPencilで開き、ローカルMCP（`openpencil-mcp`）または同じツールを呼ぶCLIで編集する。旧 `ui-design.pen` は移行前の参照用で、更新先にはしない。

```sh
open -a OpenPencil designs/roadmap-studio.fig
openpencil documents list
openpencil tree --depth 1
openpencil tool call get_font_status --args '{}'
# treeで確認した対象フレームのIDを指定する
openpencil export --node '<node-id>' --format png --scale 1 --output designs/previews/<feature>-<state>-1440.png
openpencil documents save
```

Noto Sans JPをローカルに用意し、`get_font_status` の `faithful` と `issues` を確認する。実装はCSSのフォント指定のみで、未インストール環境では日本語フォントへフォールバックする。MCPの設定は各自の環境で行い、マシン固有パスや設定ファイルをコミットしない。

移行時のJSX生成元は `designs/source/generate.mjs`。`node designs/source/generate.mjs /tmp/roadmap-design` で7つのJSXを書き出せる。作り直す場合はトークンを持つドキュメントで `render` を呼び、components → board → その他の順で作成する。生成は既存ノードへの追記なので、重複生成に注意する。通常の変更は `.fig` の既存ノードを編集する。

`.fig` 保存時にノードIDが変わることがある。保存後に `tree` でIDを確認し直し、再度開いたファイルからプレビューを書き出して、文字の重なり・枠線・アイコン・インスタンスの個別テキストを確認する。

1. 機能Issueでユーザーの課題とスコープを整理し、デザインIssueを紐づける。
2. デザインIssueに対象画面、画面幅、必要な状態、既存ルール、AIへのプロンプトを記載する。OpenPencilのMCP接続と編集対象ファイルを確認してからAIに作成・修正を依頼する。
3. 編集可能な `.fig` をリポジトリに保存し、対象フレーム名／ノードIDと画像プレビューを共有する。配置例は `designs/<feature>.fig` と `designs/previews/<feature>-<state>-<width>.png`。ローカルの絶対パスだけを共有しない。
4. デザインPRで候補と採用理由を記録する。担当デザイナーがいない場合、依頼者自身がデザイン決定者となり、AIの出力を確認して判断日と決定内容を残す。第三者のデザイナー承認は前提にしない。
5. 機能Issueに採用した `.fig` のパス・コミットと対象フレームを記録して実装する。UI実装PRでは同じ画面幅・状態のデザイン画像と実装画像を比較し、差異の理由と判断を残す。

デザインの受け入れと実装の受け入れは分ける。デザインPRで機能Issueまで閉じず、`Refs #番号` で関連付ける。機能Issueは実装の受け入れ条件を満たしたPRで閉じる。小さな変更で同じPRに含める場合も、採用判断と実装の確認結果をそれぞれ記録する。

画像だけではキーボード操作や実際の画面読み上げは確認できないため、実装後に操作を検証する。このテンプレート追加はOpenPencilのインストールやMCP設定を行うものではない。

画面状態の表は、依頼時に要否と完了条件を決め、作成後に進捗と成果物を追記する。「必要」は完成を意味しない。対象外の行は理由を記載し、進捗・成果物を「対象外」とする。受け入れ条件は「読みやすい」だけで終わらせず、対象画面幅、使用する文言、欠けずに表示する情報、エラーの伝え方など、確認できる条件に具体化する。デザインIssue内の記入例を今回の仕様に合わせて置き換える。

### 軽微なUI変更の場合

既存デザインに沿った文言・余白の微修正で、画面遷移、操作、必要な表示状態、共通デザインルールを変えない場合は、1つの機能Issueまたは不具合Issueと1つのPRで扱える。別のデザインIssue・デザインPR、候補案の比較、新規のOpenPencil成果物は省略できる。

その場合も、変更理由、参照する既存画面・コンポーネントまたは採用デザイン、具体的な受け入れ条件、変更前後の比較画像、対象画面幅での検証結果を残す。既存の `.fig` がなければ既存画面を基準にしたことを記載する。省略したデザイン関連欄は「対象外: 既存デザインに沿う軽微な修正」と記載する。新しい操作や共通ルールの変更など、デザイン判断が必要な場合は通常の手順を使う。

## PRを選ぶ

通常は[汎用テンプレート](../.github/pull_request_template.md)を使う。専用版は以下から選べる。

| ファイル                                                | 用途                               |
| ------------------------------------------------------- | ---------------------------------- |
| [design.md](../.github/PULL_REQUEST_TEMPLATE/design.md) | OpenPencilデザイン成果物と採用判断 |
| [ui.md](../.github/PULL_REQUEST_TEMPLATE/ui.md)         | 採用デザインに基づくUI実装         |
| [bugfix.md](../.github/PULL_REQUEST_TEMPLATE/bugfix.md) | 原因、修正、回帰防止の確認         |

GitHubのPR比較URLに `template` パラメーターを指定する。たとえば下記の `YOUR_BRANCH` を実際のブランチに置き換え、テンプレートのファイル名を選ぶ。

```text
https://github.com/UtakataKyosui/roadmap-creator/compare/main...YOUR_BRANCH?expand=1&template=ui.md
```

既にクエリーパラメーターがあるURLには `&template=ui.md` を追加する。GitHub CLIでは `gh pr create --template ui.md` で指定できる。既に作成したPRは、テンプレート本文をコピーして編集する。テンプレートがデフォルトブランチに入るまでは本文のコピーで確認できる。

選択方式の参考: [GitHub公式のPRテンプレート作成ガイド](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)。

## 検証結果を残す

- 基本確認は `vp check` と `vp run test --run`。このプロジェクトの `test` スクリプトは専用の `vitest.config.ts` を使用する。
- API契約を変えた場合は `vp run api:lint` と `vp run api:check` も実行する。生成物を直接編集せず、OpenAPIから再生成する。
- コマンドの成否と手動確認の環境・結果をPRに記載する。失敗や未実施の場合は理由と残作業を記載する。
- 文書だけの変更でも、相対リンク・サンプル・手順の整合性を確認する。
- スクリーンショット、ログ、プロンプトからトークン・Cookie・個人情報を除く。
