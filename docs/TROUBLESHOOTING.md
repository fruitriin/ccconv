# ccconv トラブルシューティング

## CLAUDE_CONFIG_DIR 問題（2026-03-17 発見）

### 症状
- `ccconv` (talk / raws) を実行しても今日のデータが表示されない
- `getAllData` が大量のエントリを返すが、最新のタイムスタンプが古い
- `ccconv files` で「今日作成/更新されたファイルはありません」と出る

### 原因
Claude Code は複数のバージョン・起動方法で **config ディレクトリ** が異なる：

| 場所 | 由来 |
|------|------|
| `~/.claude/projects/` | Claude Code 標準 |
| `~/.config/claude/projects/` | XDG準拠 / ccpocket-bridge 経由等 |

環境変数 `CLAUDE_CONFIG_DIR` が設定されていると、ccconv はそちらだけを読む。
現在のセッションが `~/.claude/` に書き込んでいても、ccconv が `~/.config/claude/` を見ていれば **データが見つからない**。

### 調査方法

```bash
# どのconfigDirが使われているか
echo $CLAUDE_CONFIG_DIR

# 各ディレクトリの最新jsonlを比較
ls -lt ~/.claude/projects/-Users-*/*.jsonl | head -1
ls -lt ~/.config/claude/projects/-Users-*/*.jsonl | head -1

# 現在のセッションのjsonlがどこにあるか
# （最も最近更新されたjsonlが現在のセッション）
```

### 対処
ccconv.ts (v2) は **両方のディレクトリを自動マージ** する：

1. `~/.claude/projects/`（常に候補）
2. `CLAUDE_CONFIG_DIR` が設定されていればそこも候補
3. `~/.config/claude/projects/` が存在すればそこも候補

同じセッションID（jsonlファイル名）が複数ディレクトリに存在する場合は最初に見つかったものだけを読む（重複排除）。

---

## サブディレクトリ内の jsonl

### 発見
`~/.claude/projects/<project>/` の直下に、セッションIDと同名の **ディレクトリ** が存在する：

```
~/.claude/projects/-Users-riin-workspace-riin-service/
├── 77eebc4f-....jsonl          ← jsonlファイル
├── 77eebc4f-.../               ← 同名ディレクトリ
│   ├── subagents/              ← サブエージェントのjsonl (142個)
│   └── tool-results/
├── 88974914-.../
│   └── subagents/
```

`readdirSync(projectDir).filter(f => f.endsWith('.jsonl'))` は直下のjsonlのみ返すため、サブエージェントのデータは含まれない。これは意図通り（サブエージェントの会話は別コンテキスト）。

ただし、将来的に `--include-subagents` オプションを追加してサブエージェントの会話も含められると便利かもしれない。

---

## projectFilter の部分一致問題

### 症状
`includes()` でプロジェクト名をフィルタすると、名前が前方一致するプロジェクトも巻き込む：

```
-Users-riin-workspace-riin-service          ← 本来のターゲット
-Users-riin-workspace-riin-service-docs     ← 巻き込まれる
-Users-riin-workspace-riin-service-workingDirs-savanna-smell-detector
```

### 対処
ccconv.ts では **完全一致** (`!==`) でフィルタする。

`--project=riin-service` のような短縮名で指定したい場合は `includes` が便利だが、自動推定時は完全一致が正しい。将来的に短縮名指定をサポートする場合は、明示的な `--project` オプション時のみ `includes` を使う等の分岐が必要。

---

## デバッグTips

### getAllData の中身を確認する

```bash
bun -e '
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// 両方のconfigDirを確認
for (const base of [".claude", ".config/claude"]) {
  const dir = join(homedir(), base, "projects");
  if (!existsSync(dir)) { console.log(base, ": not found"); continue; }
  const projects = readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
  console.log(base, ":", projects.length, "projects");
}
'
```

### 特定セッションのデータを確認する

```bash
# セッションID指定でtalk表示
bun ccconv.ts talk --session=77eebc4f

# jsonlの生データを確認
tail -5 ~/.claude/projects/-Users-*/<session-id>.jsonl | jq .type
```

### watchモードのデバッグ

```bash
# stderrに監視状態が出る
bun ccconv.ts talk --watch --session=<id> 2>/dev/null  # stderrを隠す
bun ccconv.ts talk --watch --session=<id>              # stderrも表示
```
