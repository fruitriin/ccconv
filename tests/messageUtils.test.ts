import { describe, test, expect } from "bun:test";
import {
  getTextContent,
  isToolUse,
  hasOnlyToolUse,
  getToolSummary,
  getToolResultContent,
  isEmptyEntry,
  isSkillPrompt,
  getSkillName,
  formatTime,
  highlightText,
  getHookPreview,
  hasThinkingOnly,
} from "../web/src/composables/useMessageUtils";

// Entry のモック
function mockEntry(overrides: any = {}): any {
  return {
    type: "assistant",
    message: { content: [] },
    ...overrides,
  };
}

// ─────────────────────────────────────────
// getTextContent
// ─────────────────────────────────────────
describe("getTextContent", () => {
  test("content が string → そのまま返す", () => {
    const entry = mockEntry({ message: { content: "hello world" } });
    expect(getTextContent(entry)).toBe("hello world");
  });

  test("content が array で type=text → text を改行結合", () => {
    const entry = mockEntry({
      message: {
        content: [
          { type: "text", text: "foo" },
          { type: "text", text: "bar" },
        ],
      },
    });
    expect(getTextContent(entry)).toBe("foo\nbar");
  });

  test("content が null → 空文字", () => {
    const entry = mockEntry({ message: { content: null } });
    expect(getTextContent(entry)).toBe("");
  });

  test("content が undefined → 空文字", () => {
    const entry = mockEntry({ message: {} });
    expect(getTextContent(entry)).toBe("");
  });

  test("message が undefined → 空文字", () => {
    const entry = mockEntry({ message: undefined });
    expect(getTextContent(entry)).toBe("");
  });

  test("content が array で text なし → 空文字", () => {
    const entry = mockEntry({
      message: {
        content: [
          { type: "tool_use", name: "Read" },
        ],
      },
    });
    expect(getTextContent(entry)).toBe("");
  });
});

// ─────────────────────────────────────────
// isToolUse
// ─────────────────────────────────────────
describe("isToolUse", () => {
  test("tool_use を含む content → true", () => {
    const entry = mockEntry({
      message: {
        content: [
          { type: "text", text: "見ろ" },
          { type: "tool_use", name: "Read" },
        ],
      },
    });
    expect(isToolUse(entry)).toBe(true);
  });

  test("tool_use なし → false", () => {
    const entry = mockEntry({
      message: {
        content: [{ type: "text", text: "テキストのみ" }],
      },
    });
    expect(isToolUse(entry)).toBe(false);
  });

  test("content が string → false", () => {
    const entry = mockEntry({ message: { content: "文字列" } });
    expect(isToolUse(entry)).toBe(false);
  });

  test("content が空配列 → false", () => {
    const entry = mockEntry({ message: { content: [] } });
    expect(isToolUse(entry)).toBe(false);
  });
});

// ─────────────────────────────────────────
// hasOnlyToolUse
// ─────────────────────────────────────────
describe("hasOnlyToolUse", () => {
  test("tool_use のみ（text なし） → true", () => {
    const entry = mockEntry({
      message: {
        content: [{ type: "tool_use", name: "Read" }],
      },
    });
    expect(hasOnlyToolUse(entry)).toBe(true);
  });

  test("tool_use + 空 text → true（空文字はtrimで消える）", () => {
    const entry = mockEntry({
      message: {
        content: [
          { type: "tool_use", name: "Read" },
          { type: "text", text: "   " },
        ],
      },
    });
    expect(hasOnlyToolUse(entry)).toBe(true);
  });

  test("tool_use + text → false", () => {
    const entry = mockEntry({
      message: {
        content: [
          { type: "tool_use", name: "Read" },
          { type: "text", text: "ちゃんとテキスト" },
        ],
      },
    });
    expect(hasOnlyToolUse(entry)).toBe(false);
  });

  test("tool_use なし → false", () => {
    const entry = mockEntry({
      message: {
        content: [{ type: "text", text: "テキスト" }],
      },
    });
    expect(hasOnlyToolUse(entry)).toBe(false);
  });

  test("content が string → false", () => {
    const entry = mockEntry({ message: { content: "文字列" } });
    expect(hasOnlyToolUse(entry)).toBe(false);
  });
});

// ─────────────────────────────────────────
// getToolSummary
// ─────────────────────────────────────────
describe("getToolSummary", () => {
  test("name + input → 'Name(key=value)'", () => {
    const tool: any = { type: "tool_use", name: "Read", input: { file_path: "/foo/bar.ts" } };
    expect(getToolSummary(tool)).toBe('Read(file_path="/foo/bar.ts")');
  });

  test("input が空オブジェクト → name のみ", () => {
    const tool: any = { type: "tool_use", name: "Read", input: {} };
    expect(getToolSummary(tool)).toBe("Read");
  });

  test("input が null → name のみ", () => {
    const tool: any = { type: "tool_use", name: "Read", input: null };
    expect(getToolSummary(tool)).toBe("Read");
  });

  test("name が undefined → '(tool)'", () => {
    const tool: any = { type: "tool_use", input: { key: "val" } };
    expect(getToolSummary(tool)).toBe('(tool)(key="val")');
  });

  test("長い value は 50文字で切られる", () => {
    const longVal = "a".repeat(60);
    const tool: any = { type: "tool_use", name: "Write", input: { content: longVal } };
    const result = getToolSummary(tool);
    // 50文字 + "..." が value 部分
    expect(result).toContain("...");
    // value の文字列部分が50文字で切れている
    expect(result).toBe(`Write(content="${"a".repeat(50)}...")`);
  });
});

// ─────────────────────────────────────────
// getToolResultContent
// ─────────────────────────────────────────
describe("getToolResultContent", () => {
  test("tool_result の content が string → そのまま", () => {
    const entry = mockEntry({
      message: {
        content: [
          { type: "tool_result", tool_use_id: "abc", content: "結果テキスト" },
        ],
      },
    });
    const results = getToolResultContent(entry);
    expect(results).toHaveLength(1);
    expect(results[0].toolUseId).toBe("abc");
    expect(results[0].text).toBe("結果テキスト");
  });

  test("tool_result の content が text array → text 結合", () => {
    const entry = mockEntry({
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "xyz",
            content: [
              { type: "text", text: "line1" },
              { type: "text", text: "line2" },
            ],
          },
        ],
      },
    });
    const results = getToolResultContent(entry);
    expect(results[0].text).toBe("line1\nline2");
  });

  test("tool_result の content が tool_reference → tool_name 結合", () => {
    const entry = mockEntry({
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "ref1",
            content: [
              { type: "tool_result_reference", tool_name: "SomeTool" },
            ],
          },
        ],
      },
    });
    const results = getToolResultContent(entry);
    expect(results[0].text).toBe("SomeTool");
  });

  test("tool_result がない → 空配列", () => {
    const entry = mockEntry({
      message: {
        content: [{ type: "text", text: "普通のテキスト" }],
      },
    });
    expect(getToolResultContent(entry)).toEqual([]);
  });
});

// ─────────────────────────────────────────
// isEmptyEntry
// ─────────────────────────────────────────
describe("isEmptyEntry", () => {
  test("テキストあり → false", () => {
    const entry = mockEntry({
      message: { content: [{ type: "text", text: "内容あり" }] },
    });
    expect(isEmptyEntry(entry)).toBe(false);
  });

  test("tool_use あり → false", () => {
    const entry = mockEntry({
      message: { content: [{ type: "tool_use", name: "Read" }] },
    });
    expect(isEmptyEntry(entry)).toBe(false);
  });

  test("thinking のみ → false（hasThinkingOnly が true になるため）", () => {
    const entry = mockEntry({
      message: { content: [{ type: "thinking", thinking: "考え中" }] },
    });
    expect(isEmptyEntry(entry)).toBe(false);
  });

  test("tool_result のみ（isToolResultEntry が true の場合） → false", () => {
    const entry = mockEntry({
      message: {
        content: [{ type: "tool_result", tool_use_id: "id1", content: "ok" }],
      },
    });
    const result = isEmptyEntry(entry, {
      isHook: () => false,
      isToolResultEntry: () => true,
    });
    expect(result).toBe(false);
  });

  test("content が null → true", () => {
    const entry = mockEntry({ message: { content: null } });
    expect(isEmptyEntry(entry)).toBe(true);
  });

  test("content が空配列 → true", () => {
    const entry = mockEntry({ message: { content: [] } });
    expect(isEmptyEntry(entry)).toBe(true);
  });

  test("content が空 text のみ → true", () => {
    const entry = mockEntry({
      message: { content: [{ type: "text", text: "   " }] },
    });
    expect(isEmptyEntry(entry)).toBe(true);
  });

  test("isHook が true を返す場合 → false", () => {
    const entry = mockEntry({ message: { content: [] } });
    const result = isEmptyEntry(entry, {
      isHook: () => true,
      isToolResultEntry: () => false,
    });
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────
// isSkillPrompt
// ─────────────────────────────────────────
describe("isSkillPrompt", () => {
  const longBase = "x".repeat(200);

  test("type=user + 200文字以上 + $ARGUMENTS → true", () => {
    const text = longBase + " $ARGUMENTS";
    const entry = mockEntry({
      type: "user",
      message: { content: text },
    });
    expect(isSkillPrompt(entry)).toBe(true);
  });

  test("type=user + 200文字以上 + '# /' で始まる → true", () => {
    const text = "# /remember\n" + longBase;
    const entry = mockEntry({
      type: "user",
      message: { content: text },
    });
    expect(isSkillPrompt(entry)).toBe(true);
  });

  test("type=user + 200文字以上 + '---\\n' で始まる → true", () => {
    const text = "---\nname: recall\n" + longBase;
    const entry = mockEntry({
      type: "user",
      message: { content: text },
    });
    expect(isSkillPrompt(entry)).toBe(true);
  });

  test("type=assistant → false", () => {
    const text = longBase + " $ARGUMENTS";
    const entry = mockEntry({
      type: "assistant",
      message: { content: text },
    });
    expect(isSkillPrompt(entry)).toBe(false);
  });

  test("短いメッセージ（200文字未満） → false", () => {
    const entry = mockEntry({
      type: "user",
      message: { content: "短いメッセージ $ARGUMENTS" },
    });
    expect(isSkillPrompt(entry)).toBe(false);
  });
});

// ─────────────────────────────────────────
// getSkillName
// ─────────────────────────────────────────
describe("getSkillName", () => {
  test("'# /remember — ...' → '/remember'", () => {
    const entry = mockEntry({
      message: { content: "# /remember — 記憶を刻む\n詳細テキスト" },
    });
    expect(getSkillName(entry)).toBe("/remember");
  });

  test("フロントマター内 name: recall → '/recall'", () => {
    const entry = mockEntry({
      message: { content: "---\nname: recall\n---\n詳細" },
    });
    expect(getSkillName(entry)).toBe("/recall");
  });

  test("パターン不一致 → '/skill'", () => {
    const entry = mockEntry({
      message: { content: "普通のテキスト" },
    });
    expect(getSkillName(entry)).toBe("/skill");
  });
});

// ─────────────────────────────────────────
// formatTime
// ─────────────────────────────────────────
describe("formatTime", () => {
  test("ISO文字列 → 'HH:MM:SS' 形式（ja-JP ロケール）", () => {
    const result = formatTime("2026-03-21T15:30:45.000Z");
    // ja-JP ロケールの HH:MM:SS パターンにマッチすること
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  test("undefined → 空文字", () => {
    expect(formatTime(undefined)).toBe("");
  });

  test("空文字 → 空文字", () => {
    expect(formatTime("")).toBe("");
  });
});

// ─────────────────────────────────────────
// highlightText
// ─────────────────────────────────────────
describe("highlightText", () => {
  test("検索語がマッチ → <mark> で囲む", () => {
    const result = highlightText("hello world", "world");
    expect(result).toBe("hello <mark>world</mark>");
  });

  test("検索語なし（空文字） → そのまま返す", () => {
    expect(highlightText("hello world", "")).toBe("hello world");
  });

  test("大文字小文字無視でマッチ", () => {
    const result = highlightText("Hello World", "hello");
    expect(result).toBe("<mark>Hello</mark> World");
  });

  test("複数箇所マッチ → 全て <mark> で囲む", () => {
    const result = highlightText("abc abc abc", "abc");
    expect(result).toBe("<mark>abc</mark> <mark>abc</mark> <mark>abc</mark>");
  });

  test("正規表現特殊文字を含む検索語 → エスケープして扱う", () => {
    const result = highlightText("price: $100", "$100");
    expect(result).toBe("price: <mark>$100</mark>");
  });
});

// ─────────────────────────────────────────
// getHookPreview
// ─────────────────────────────────────────
describe("getHookPreview", () => {
  test("string content の system-reminder タグ → 中身を抽出", () => {
    const inner = "reminder content here";
    const entry = mockEntry({
      message: { content: `before <system-reminder>${inner}</system-reminder> after` },
    });
    expect(getHookPreview(entry)).toBe(inner);
  });

  test("120文字超えた場合 → 120文字で切る", () => {
    const inner = "a".repeat(200);
    const entry = mockEntry({
      message: { content: `<system-reminder>${inner}</system-reminder>` },
    });
    expect(getHookPreview(entry)).toHaveLength(120);
  });

  test("system-reminder タグなし → 先頭120文字", () => {
    const content = "b".repeat(200);
    const entry = mockEntry({ message: { content } });
    expect(getHookPreview(entry)).toBe("b".repeat(120));
  });

  test("array content の text に system-reminder → 中身を抽出", () => {
    const inner = "array reminder";
    const entry = mockEntry({
      message: {
        content: [
          { type: "text", text: `<system-reminder>${inner}</system-reminder>` },
        ],
      },
    });
    expect(getHookPreview(entry)).toBe(inner);
  });

  test("array content で system-reminder なし → 空文字", () => {
    const entry = mockEntry({
      message: {
        content: [{ type: "text", text: "普通のテキスト" }],
      },
    });
    expect(getHookPreview(entry)).toBe("");
  });
});

// ─────────────────────────────────────────
// hasThinkingOnly
// ─────────────────────────────────────────
describe("hasThinkingOnly", () => {
  test("thinking のみ → true", () => {
    const entry = mockEntry({
      message: {
        content: [{ type: "thinking", thinking: "考え中..." }],
      },
    });
    expect(hasThinkingOnly(entry)).toBe(true);
  });

  test("thinking + text → false", () => {
    const entry = mockEntry({
      message: {
        content: [
          { type: "thinking", thinking: "考え中..." },
          { type: "text", text: "結論" },
        ],
      },
    });
    expect(hasThinkingOnly(entry)).toBe(false);
  });

  test("thinking + tool_use → false", () => {
    const entry = mockEntry({
      message: {
        content: [
          { type: "thinking", thinking: "考え中..." },
          { type: "tool_use", name: "Read" },
        ],
      },
    });
    expect(hasThinkingOnly(entry)).toBe(false);
  });

  test("thinking なし → false", () => {
    const entry = mockEntry({
      message: {
        content: [{ type: "text", text: "テキストのみ" }],
      },
    });
    expect(hasThinkingOnly(entry)).toBe(false);
  });

  test("content が string → false", () => {
    const entry = mockEntry({ message: { content: "thinking..." } });
    expect(hasThinkingOnly(entry)).toBe(false);
  });
});
