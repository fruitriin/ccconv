# ccconv - Claude Code Conversations

[README(日本語)](README.md) | [README(English)](README.us.md)

Claude Code の会話ログをコマンドラインで扱うためのツール

## 概要

このツールは `~/.claude/projects/` に保存されている Claude Code の会話ログを読み込み、様々な形式でデータの表示・解析を行います。

## インストール

```bash
npm install --global ccconv
```

グローバルインストール後は `ccconv` コマンドとして使用できます。

## 使い方

### 基本コマンド

```bash
# 今日のログファイル一覧と統計を表示
node ccconv.js

# 今日の会話データをJSONで出力（デフォルト）
node ccconv.js raws

# 全会話データをJSONで出力
node ccconv.js raws --since=all

# 指定日以降の会話データをJSONで出力
node ccconv.js raws --since=2024-08-20

# 今日更新されたプロジェクト一覧を表示（デフォルト）
node ccconv.js projects

# 全プロジェクトの一覧とサマリを表示
node ccconv.js projects --since=all

# 直近4時間のトークン使用量を表示
node ccconv.js tokens
```

### プロジェクト表示オプション

```bash
# コンパクトな1行形式で表示
node ccconv.js projects --one-line

# トークン数順でソート
node ccconv.js projects --sort=tokens

# メッセージ数順でソート
node ccconv.js projects --sort=messages

# JSON形式で出力
node ccconv.js projects --json
```

### データフィルタリング

```bash
# 指定した列のみを出力
node ccconv.js raws --column=timestamp,type,message.content

# メッセージタイプでフィルタリング
node ccconv.js raws --type=user          # ユーザーメッセージのみ（tool_result除外）
node ccconv.js raws --type=userandtools # ユーザーメッセージ（tool_result含む）
node ccconv.js raws --type=assistant    # アシスタントメッセージ + tool_result
```

## 機能

### データ表示

- **デフォルト**: 今日作成・更新されたファイルの一覧、サイズ、メッセージ数、トークン使用量を表示
- **raws**: 会話データを JSON フォーマットで出力（デフォルト：今日のデータのみ）
- **projects**: プロジェクトの一覧とサマリを表示（デフォルト：今日更新分のみ）
- **tokens**: 直近 4 時間のトークン使用量の合計を表示

### 日付フィルタリング

- **--since=all**: 全期間のデータを表示
- **--since=日付**: 指定日以降のデータを表示（例: `--since=2024-08-20`）
- **デフォルト**: `--since` オプションがない場合は今日のデータのみ表示

### プロジェクト表示形式

- **標準形式**: 詳細な情報を複数行で表示
- **--one-line**: コンパクトな1行形式（💬メッセージ数 ⏱️期間 📅最終更新）
- **--json**: JSON形式で出力
- **--sort=**: ソート順を指定（tokens/messages/update）

### その他のフィルタリング機能

- **カラムフィルタ**: `--column=` で表示する項目を指定
- **タイプフィルタ**: `--type=` でメッセージタイプを指定
- **ネストアクセス**: `message.content[0].text` のような深い階層へのアクセスが可能

### 例

```bash
# 指定日以降のアシスタントメッセージのタイムスタンプとトークン使用量のみ表示
node ccconv.js raws --since=2024-08-20 --column=timestamp,message.usage --type=assistant

# 今日のプロジェクトをトークン数順で1行表示
node ccconv.js projects --one-line --sort=tokens

# 全期間のセッションIDと作業ディレクトリのみ表示
node ccconv.js raws --since=all --column=sessionId,cwd --type=user
```

## データ構造

Claude Code のログデータは以下の構造になっています:

```javascript
{
  "parentUuid": "前のメッセージのUUID (最初はnull)",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/作業ディレクトリ",
  "sessionId": "セッションID",
  "version": "Claude Codeのバージョン",
  "gitBranch": "Gitブランチ名",
  "type": "user" | "assistant",
  "message": { /* メッセージ内容 */ },
  "uuid": "このメッセージのUUID",
  "timestamp": "ISO8601形式のタイムスタンプ"
}
```

## 必要環境

- Node.js
- Claude Code がインストールされていること（ログファイルが `~/.claude/projects/` に存在すること）

## ライセンス

MIT
