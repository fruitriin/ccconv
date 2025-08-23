# claudelog

Claude Code の会話ログを解析するコマンドラインツール

## 概要

このツールは `~/.claude/projects/` に保存されている Claude Code の会話ログを読み込み、様々な形式でデータの表示・解析を行います。

## 使い方

```bash
# 今日のログファイル一覧と統計を表示
node claudelog.js

# 全データをJSONで出力
node claudelog.js raws

# 指定した列のみを出力
node claudelog.js raws --column=timestamp,type,message.content

# メッセージタイプでフィルタリング
node claudelog.js raws --type=user          # ユーザーメッセージのみ（tool_result除外）
node claudelog.js raws --type=userandtools # ユーザーメッセージ（tool_result含む）
node claudelog.js raws --type=assistant    # アシスタントメッセージ + tool_result

# 直近4時間のトークン使用量を表示
node claudelog.js tokens
```

## 機能

### データ表示
- **デフォルト**: 今日作成・更新されたファイルの一覧、サイズ、メッセージ数、トークン使用量を表示
- **raws**: 全ての会話データをJSONフォーマットで出力
- **tokens**: 直近4時間のトークン使用量の合計を表示

### フィルタリング機能
- **カラムフィルタ**: `--column=` で表示する項目を指定
- **タイプフィルタ**: `--type=` でメッセージタイプを指定
- **ネストアクセス**: `message.content[0].text` のような深い階層へのアクセスが可能

### 例

```bash
# アシスタントメッセージのタイムスタンプとトークン使用量のみ表示
node claudelog.js raws --column=timestamp,message.usage --type=assistant

# セッションIDと作業ディレクトリのみ表示
node claudelog.js raws --column=sessionId,cwd --type=user
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