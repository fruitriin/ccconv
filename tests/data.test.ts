import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── テスト用の仮想プロジェクトディレクトリを環境変数で差し替える ──────────────
// data.ts は process.argv を参照する。CLAUDE_CONFIG_DIR でも上書きできるが、
// resolveConfigDirs がモジュールロード時に評価される点に注意。
// そのため単体テスト向けに applySinceFilter / resolveSinceDate 相当の
// ロジックを直接テストできる export を使う。
// integration テストではファイルシステムごとモックする。

import {
  applySinceFilter,
  readJsonlFile,
  resolveConfigDirs,
  today,
  type Entry,
} from "../src/data";

// ── helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    type: "user",
    message: { role: "user", content: "test" },
    ...overrides,
  };
}

// ── applySinceFilter ──────────────────────────────────────────────────────────

describe("applySinceFilter", () => {
  const entries: Entry[] = [
    makeEntry({ timestamp: daysAgo(0) }),   // 今日
    makeEntry({ timestamp: daysAgo(2) }),   // 2日前
    makeEntry({ timestamp: daysAgo(5) }),   // 5日前
    makeEntry({ timestamp: daysAgo(10) }),  // 10日前
    makeEntry({ timestamp: undefined }),    // タイムスタンプなし
  ];

  test('since="all" は全エントリを返す（タイムスタンプなし含む）', () => {
    const result = applySinceFilter(entries, "all");
    expect(result.length).toBe(5);
  });

  test('since=null は今日のエントリのみ返す', () => {
    const result = applySinceFilter(entries, null);
    // 今日のエントリ1件だけ（タイムスタンプなしは除外）
    expect(result.length).toBe(1);
    expect(new Date(result[0].timestamp!).toISOString().split("T")[0]).toBe(today);
  });

  test('since="today" は今日のエントリのみ返す', () => {
    const result = applySinceFilter(entries, "today");
    expect(result.length).toBe(1);
    expect(new Date(result[0].timestamp!).toISOString().split("T")[0]).toBe(today);
  });

  test('since="3days" は3日以内のエントリを返す', () => {
    const result = applySinceFilter(entries, "3days");
    // 今日(0日前) と 2日前 の2件
    expect(result.length).toBe(2);
  });

  test('since="week" は7日以内のエントリを返す', () => {
    const result = applySinceFilter(entries, "week");
    // 今日(0日前)、2日前、5日前 の3件
    expect(result.length).toBe(3);
  });

  test('since="month" は30日以内のエントリを返す', () => {
    const result = applySinceFilter(entries, "month");
    // 今日(0日前)、2日前、5日前、10日前 の4件（タイムスタンプなしは除外）
    expect(result.length).toBe(4);
  });

  test("タイムスタンプなしのエントリは除外される", () => {
    const result = applySinceFilter(entries, null);
    expect(result.every((e) => e.timestamp != null)).toBe(true);
  });

  test('since="2026-01-01" のような固定日付で絞り込める', () => {
    // 全期間テスト用に since="all" と比較
    const all = applySinceFilter(entries, "all");
    const fixed = applySinceFilter(entries, "2020-01-01");
    // 2020年以降なら全タイムスタンプあり4件が返るはず
    expect(fixed.length).toBe(4);
    expect(fixed.length).toBeLessThanOrEqual(all.length);
  });

  test("無効な日付はフォールバック（今日）として扱う", () => {
    // 無効な日付 → resolveSinceDate は today にフォールバックするため since=null と同じ挙動
    const result = applySinceFilter(entries, "invalid-date");
    const expected = applySinceFilter(entries, null);
    expect(result.length).toBe(expected.length);
  });

  test("空配列を渡すと空配列が返る", () => {
    expect(applySinceFilter([], "all")).toEqual([]);
    expect(applySinceFilter([], null)).toEqual([]);
  });
});

// ── readJsonlFile ─────────────────────────────────────────────────────────────

describe("readJsonlFile", () => {
  const tmpDir = join(tmpdir(), `ccconv-test-${Date.now()}`);
  const testFile = join(tmpDir, "test-session.jsonl");

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
    const lines = [
      JSON.stringify({ type: "user", message: { content: "hello" }, timestamp: daysAgo(0) }),
      JSON.stringify({ type: "assistant", message: { content: "world" }, timestamp: daysAgo(0) }),
      "invalid json line",
    ].join("\n");
    writeFileSync(testFile, lines, "utf8");
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("正常なJSONLファイルをパースしてエントリを返す", () => {
    const entries = readJsonlFile(testFile, "test-project", "test-session.jsonl");
    // 正常な2行だけ返る（invalid json は無視）
    expect(entries.length).toBe(2);
  });

  test("各エントリに _filePath, _projectDir, _fileName が付与される", () => {
    const entries = readJsonlFile(testFile, "test-project", "test-session.jsonl");
    for (const e of entries) {
      expect(e._filePath).toBe(testFile);
      expect(e._projectDir).toBe("test-project");
      expect(e._fileName).toBe("test-session.jsonl");
    }
  });

  test("extraFields が各エントリにマージされる", () => {
    const extra = { _isSubagent: true, _agentId: "agent-abc" };
    const entries = readJsonlFile(testFile, "test-project", "test-session.jsonl", extra);
    expect(entries.every((e) => e._isSubagent === true)).toBe(true);
    expect(entries.every((e) => e._agentId === "agent-abc")).toBe(true);
  });

  test("存在しないファイルは空配列を返す", () => {
    const entries = readJsonlFile("/nonexistent/path.jsonl", "proj", "file.jsonl");
    expect(entries).toEqual([]);
  });

  test("空ファイルは空配列を返す", () => {
    const emptyFile = join(tmpDir, "empty.jsonl");
    writeFileSync(emptyFile, "", "utf8");
    const entries = readJsonlFile(emptyFile, "proj", "empty.jsonl");
    expect(entries).toEqual([]);
  });
});

// ── resolveConfigDirs ─────────────────────────────────────────────────────────

describe("resolveConfigDirs", () => {
  test("引数なしでもデフォルトディレクトリを返す", () => {
    const dirs = resolveConfigDirs([]);
    expect(Array.isArray(dirs)).toBe(true);
    expect(dirs.length).toBeGreaterThan(0);
  });

  test("-d フラグで指定したディレクトリを返す", () => {
    const dirs = resolveConfigDirs(["-d", "/custom/path"]);
    expect(dirs).toEqual(["/custom/path"]);
  });

  test("--dir= フラグで指定したディレクトリを返す", () => {
    const dirs = resolveConfigDirs(["--dir=/custom/path2"]);
    expect(dirs).toEqual(["/custom/path2"]);
  });

  test("デフォルト設定は ~/.claude を含む", () => {
    const dirs = resolveConfigDirs([]);
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    expect(dirs.some((d) => d.includes(".claude"))).toBe(true);
  });
});

// ── today ─────────────────────────────────────────────────────────────────────

describe("today", () => {
  test("today は YYYY-MM-DD 形式の文字列", () => {
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("today は現在の日付", () => {
    const expected = new Date().toISOString().split("T")[0];
    expect(today).toBe(expected);
  });
});

// ── integration: getAllData / getProjects / getSessions / getTokenStats ────────
// 実際の ~/.config/claude/projects/ を読む統合テスト。
// データが存在しない環境ではスキップする。

describe("integration", () => {
  // data.ts の projectsDirs が実際に存在するか確認
  const { projectsDirs } = require("../src/data");
  const hasData = projectsDirs.some((d: string) => existsSync(d));

  if (!hasData) {
    test.skip("projectsDir が存在しないためスキップ", () => {});
    return;
  }

  const { getAllData, getProjects, getSessions, getTokenStats } = require("../src/data");

  describe("getAllData", () => {
    test("デフォルトで配列を返す", () => {
      const data = getAllData();
      expect(Array.isArray(data)).toBe(true);
    });

    test("subagents=false のとき _isSubagent なエントリは含まれない", () => {
      const data = getAllData({ subagents: false });
      expect(data.every((e: Entry) => !e._isSubagent)).toBe(true);
    });

    test("subagents=true のとき _isSubagent なエントリが含まれることがある", () => {
      const data = getAllData({ subagents: true });
      // サブエージェントが存在しない環境では0件でも OK
      expect(Array.isArray(data)).toBe(true);
    });

    test("projectFilter で絞り込みができる", () => {
      const all = getAllData();
      if (all.length === 0) return;

      const firstProject = all[0]._projectDir!;
      const filtered = getAllData({ projectFilter: firstProject });
      expect(filtered.every((e: Entry) => e._projectDir === firstProject)).toBe(true);
    });

    test("sessionFilter で絞り込みができる", () => {
      const all = getAllData();
      if (all.length === 0) return;

      const firstSession = all.find((e: Entry) => e._fileName)!._fileName!.replace(".jsonl", "");
      const sessionPrefix = firstSession.substring(0, 8);
      const filtered = getAllData({ sessionFilter: sessionPrefix });
      expect(
        filtered.every((e: Entry) => e._fileName?.startsWith(sessionPrefix))
      ).toBe(true);
    });
  });

  describe("getProjects", () => {
    test("配列を返す", () => {
      const projects = getProjects({ sinceFilter: "all" });
      expect(Array.isArray(projects)).toBe(true);
    });

    test("各プロジェクトが必要なフィールドを持つ", () => {
      const projects = getProjects({ sinceFilter: "all" });
      for (const p of projects) {
        expect(typeof p.name).toBe("string");
        expect(typeof p.fileCount).toBe("number");
        expect(typeof p.totalMessages).toBe("number");
        expect(typeof p.inputTokens).toBe("number");
        expect(typeof p.outputTokens).toBe("number");
        expect(typeof p.totalTokens).toBe("number");
        expect(typeof p.subagentCount).toBe("number");
        expect(p.lastUpdate instanceof Date).toBe(true);
      }
    });

    test('sortBy="tokens" でトークン降順にソートされる', () => {
      const projects = getProjects({ sinceFilter: "all", sortBy: "tokens" });
      for (let i = 0; i < projects.length - 1; i++) {
        expect(projects[i].totalTokens).toBeGreaterThanOrEqual(projects[i + 1].totalTokens);
      }
    });

    test('sortBy="messages" でメッセージ降順にソートされる', () => {
      const projects = getProjects({ sinceFilter: "all", sortBy: "messages" });
      for (let i = 0; i < projects.length - 1; i++) {
        expect(projects[i].totalMessages).toBeGreaterThanOrEqual(projects[i + 1].totalMessages);
      }
    });

    test('sortBy 未指定は名前昇順', () => {
      const projects = getProjects({ sinceFilter: "all" });
      for (let i = 0; i < projects.length - 1; i++) {
        expect(projects[i].name.localeCompare(projects[i + 1].name)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe("getSessions", () => {
    test("配列を返す", () => {
      const sessions = getSessions(null);
      expect(Array.isArray(sessions)).toBe(true);
    });

    test("各セッションが必要なフィールドを持つ", () => {
      const sessions = getSessions(null);
      for (const s of sessions) {
        expect(typeof s.sessionId).toBe("string");
        expect(typeof s.messageCount).toBe("number");
        expect(typeof s.subagentCount).toBe("number");
        // timestamp は文字列（空の場合もある）
        expect(typeof s.firstTimestamp).toBe("string");
        expect(typeof s.lastTimestamp).toBe("string");
      }
    });

    test("lastTimestamp 降順でソートされている", () => {
      const sessions = getSessions(null);
      for (let i = 0; i < sessions.length - 1; i++) {
        if (sessions[i].lastTimestamp && sessions[i + 1].lastTimestamp) {
          expect(sessions[i].lastTimestamp >= sessions[i + 1].lastTimestamp).toBe(true);
        }
      }
    });
  });

  describe("getTokenStats", () => {
    test("必要なフィールドを持ち、各値が 0 以上の数値を返す", { timeout: 60000 }, () => {
      const stats = getTokenStats();
      expect(typeof stats.inputTokens).toBe("number");
      expect(typeof stats.outputTokens).toBe("number");
      expect(typeof stats.cacheCreationTokens).toBe("number");
      expect(typeof stats.cacheReadTokens).toBe("number");
      expect(typeof stats.sessionCount).toBe("number");
      expect(stats.inputTokens).toBeGreaterThanOrEqual(0);
      expect(stats.outputTokens).toBeGreaterThanOrEqual(0);
      expect(stats.cacheCreationTokens).toBeGreaterThanOrEqual(0);
      expect(stats.cacheReadTokens).toBeGreaterThanOrEqual(0);
      expect(stats.sessionCount).toBeGreaterThanOrEqual(0);
    });
  });
});
