# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-03-21

### Added
- `web` サブコマンド: Vue 3 + Vite による Web ダッシュボード (`ccconv web` で起動)
- 3表示モード: 📋リニア / 🪟ペイン / 📜フロー
- ⏱タイムライン同期: CSS Grid で並列ペインの同時刻メッセージを横揃え
- 6種フィルタ: User / Assistant / Tools / Thinking / Hooks / Subagents（後者3つは3状態トグル）
- Zellij ライクなペイン分割: Agent パターン（メイン停止）+ Team パターン（👑 Main 並列）
- URL ルーティング (`/#/project/session`)
- アンカー機構: フィルタ切替時にスクロール位置を保持
- サイドバーリサイズ（ドラッグ）
- スキルプロンプト自動折りたたみ (`/skill名` 表示)
- Tool Result 折りたたみ展開
- 内製ツールチップ（マウス追従、即座表示）
- フローティングスピナー
- プロジェクト選択時に最新セッション自動選択
- テスト 130件 (messageUtils 58 + data 35 + server 30 + dedup 7)

### Changed
- データ層分離: `src/data.ts` に getAllData, getProjects, getSessions 等を抽出
- API サーバー: `src/server.ts` に Bun.serve() REST API を実装
- UnoCSS 導入（素 CSS → ユーティリティクラス）

## [0.2.0] - 2026-03-21

### Added
- `subagents` サブコマンド: サブエージェント一覧（ID / モデル / メッセージ数 / 最初の指示文）
- `talk --subagents`: 親セッション内にサブエージェント会話をツリー表示 (┏━/┃/┗━)
- `projects` にサブエージェント統計 (🤖N)
- サブエージェント UUID 重複排除（コンパクト化ファイル対応）

### Changed
- 期間フィルタ: `3days` / `week` / `month` の相対指定に対応
- セッション一覧を日時降順にソート

## [0.1.0] - 2026-03-17

### Added
- `talk` サブコマンド: 会話をリアルタイムに読みやすい形式で出力
- `--watch` オプション: jsonlファイルの変更を監視し、差分を即座に出力
- `--session=<id>` オプション: セッションIDで絞り込み
- `--thinking` オプション: thinkingブロックを表示
- `--tools` / `--tools=meta` オプション: ツール呼び出しの表示制御
- `files` サブコマンド: 旧デフォルト（今日のファイル一覧）を退避
- プロジェクト自動選定: cwd から projectDirName を推定

### Changed
- **デフォルト動作を `talk` 形式に変更**: 引数なし `ccconv` で今日の会話を talk 形式で出力
- Node.js → Bun (TypeScript) に完全移行。ccconv.js を削除
- 複数の configDir を候補として探索（~/.claude, CLAUDE_CONFIG_DIR, ~/.config/claude）
- セッション重複排除の追加

### Removed
- ccconv.js（Node.js旧版）を削除。ccconv.ts に完全移行

## [0.0.2] - 2025-08-23

### Added
- `--format=talk` option for conversation-style readable output with timestamps
- `--format=plain` option for simple key: value format output
- `--reverse` option for reverse chronological display (newest messages first)
- Enhanced timezone handling to display times in local timezone instead of UTC
- Comprehensive usage examples in all documentation files

### Changed
- Improved time display formatting with local timezone consideration
- Updated all documentation (README.md, README.us.md, CLAUDE.md) with new format options
- Enhanced function signatures to support new formatting and sorting options

### Fixed
- Fixed timezone display issue where times were shown in UTC instead of local time
- Improved error handling for invalid timestamps in format functions

## [0.0.1] - 2025-08-23

### Added
- Initial release of ccconv (Claude Code Conversations tool)
- Basic command-line interface for analyzing Claude Code conversation logs
- `projects` command to display project summaries with statistics
- `raws` command to export conversation data in JSON format
- `tokens` command to show token usage for recent sessions
- `--since` option to filter data by date (replaces `--today`)
- `--project` option to filter data by specific project
- `--column` option to specify which fields to display
- `--type` option to filter by message type (user/assistant/userandtools)
- Support for nested property access and array notation
- Multiple display formats for projects (standard, one-line, JSON)
- Sorting options for projects (by tokens, messages, update time)
- Dual-language documentation (Japanese and English)
- Comprehensive error handling and validation

### Features
- Automatic discovery and processing of all Claude Code project logs
- Flexible date filtering with support for specific dates or all data
- Type-based message filtering with special handling for tool results
- Token usage analytics and aggregation
- File statistics and project activity tracking
- Support for complex data structures and nested object access