import { describe, test, expect } from "bun:test";

/**
 * PaneLayout のセグメント分割ロジックをテストする。
 * Vue コンポーネントのテストではなく、ロジックを抽出してテスト。
 */

// --- PaneLayout から抽出したロジック ---

interface ConvItem {
  type: "entry" | "subagent";
  entry?: { timestamp?: string; uuid?: string; _isSubagent?: boolean; _agentId?: string };
  group?: { agentId: string; entries: any[] };
}

interface GroupRange {
  agentId: string;
  entries: any[];
  start: string;
  end: string;
  description?: string;
  model?: string;
}

type Segment =
  | { type: "main"; items: ConvItem[] }
  | { type: "parallel"; groups: GroupRange[]; mainItems?: ConvItem[] }
  | { type: "single-agent"; group: { agentId: string; entries: any[] } };

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Team 対応版のセグメント分割。
 * メインとサブエージェントが時間的に重複する場合、parallel セグメントにメインも含める。
 */
function buildSegments(displayItems: ConvItem[]): Segment[] {
  const result: Segment[] = [];

  const subagentItems = displayItems.filter((item) => item.type === "subagent" && item.group);
  const mainItems = displayItems.filter((item) => item.type === "entry");

  const groupRanges: GroupRange[] = subagentItems.map((item) => {
    const group = item.group!;
    const timestamps = group.entries
      .map((e: any) => e.timestamp ?? "")
      .filter(Boolean)
      .sort();
    return {
      agentId: group.agentId,
      entries: group.entries,
      start: timestamps[0] ?? "",
      end: timestamps[timestamps.length - 1] ?? "",
    };
  });

  // 全イベントを時系列ソート
  const allEvents: Array<{ kind: "main"; item: ConvItem } | { kind: "group"; range: GroupRange }> =
    [];
  for (const item of mainItems) {
    allEvents.push({ kind: "main", item });
  }
  for (const gr of groupRanges) {
    allEvents.push({ kind: "group", range: gr });
  }
  allEvents.sort((a, b) => {
    const ta = a.kind === "main" ? (a.item.entry?.timestamp ?? "") : a.range.start;
    const tb = b.kind === "main" ? (b.item.entry?.timestamp ?? "") : b.range.start;
    return ta.localeCompare(tb);
  });

  let currentMainItems: ConvItem[] = [];
  let pendingGroups: GroupRange[] = [];

  function flushMainItems() {
    if (currentMainItems.length > 0) {
      result.push({ type: "main", items: [...currentMainItems] });
      currentMainItems = [];
    }
  }

  function flushPendingGroups() {
    if (pendingGroups.length === 0) return;
    if (pendingGroups.length === 1) {
      result.push({
        type: "single-agent",
        group: { agentId: pendingGroups[0].agentId, entries: pendingGroups[0].entries },
      });
    } else {
      result.push({
        type: "parallel",
        groups: pendingGroups,
      });
    }
    pendingGroups = [];
  }

  // Team 対応: メインエントリがサブエージェントと時間的に重複するかチェック
  function mainOverlapsWithPending(timestamp: string): boolean {
    if (!timestamp || pendingGroups.length === 0) return false;
    return pendingGroups.some((pg) => timestamp >= pg.start && timestamp <= pg.end);
  }

  // parallel 区間中のメインアイテムを追跡
  let parallelMainItems: ConvItem[] = [];

  for (const event of allEvents) {
    if (event.kind === "main") {
      const ts = event.item.entry?.timestamp ?? "";
      if (mainOverlapsWithPending(ts)) {
        // メインがサブエージェントと並列 → parallel 用に溜める
        parallelMainItems.push(event.item);
      } else {
        // メインが単独 → pending をフラッシュ（parallel 中の main も含めて）
        if (pendingGroups.length > 0) {
          if (pendingGroups.length === 1 && parallelMainItems.length === 0) {
            result.push({
              type: "single-agent",
              group: { agentId: pendingGroups[0].agentId, entries: pendingGroups[0].entries },
            });
          } else {
            result.push({
              type: "parallel",
              groups: pendingGroups,
              mainItems: parallelMainItems.length > 0 ? [...parallelMainItems] : undefined,
            });
          }
          pendingGroups = [];
          parallelMainItems = [];
        }
        currentMainItems.push(event.item);
      }
    } else {
      const gr = event.range;

      // pending がなく、currentMainItems がこのグループと重複するなら
      // currentMainItems を parallelMainItems に移す
      if (pendingGroups.length === 0) {
        const mainOverlaps = currentMainItems.some(
          (item) =>
            item.entry?.timestamp && rangesOverlap(item.entry.timestamp, item.entry.timestamp, gr.start, gr.end)
        );
        if (mainOverlaps) {
          parallelMainItems.push(...currentMainItems);
          currentMainItems = [];
        } else {
          flushMainItems();
        }
        pendingGroups.push(gr);
      } else {
        const overlaps = pendingGroups.some((pg) =>
          rangesOverlap(pg.start, pg.end, gr.start, gr.end)
        );
        if (overlaps) {
          pendingGroups.push(gr);
        } else {
          // 重複しない → フラッシュして新規
          if (pendingGroups.length === 1 && parallelMainItems.length === 0) {
            result.push({
              type: "single-agent",
              group: { agentId: pendingGroups[0].agentId, entries: pendingGroups[0].entries },
            });
          } else {
            result.push({
              type: "parallel",
              groups: pendingGroups,
              mainItems: parallelMainItems.length > 0 ? [...parallelMainItems] : undefined,
            });
          }
          pendingGroups = [gr];
          parallelMainItems = [];
        }
      }
    }
  }

  // 残りをフラッシュ
  if (pendingGroups.length > 0) {
    if (pendingGroups.length === 1 && parallelMainItems.length === 0) {
      result.push({
        type: "single-agent",
        group: { agentId: pendingGroups[0].agentId, entries: pendingGroups[0].entries },
      });
    } else {
      result.push({
        type: "parallel",
        groups: pendingGroups,
        mainItems: parallelMainItems.length > 0 ? [...parallelMainItems] : undefined,
      });
    }
  }
  flushMainItems();

  return result;
}

// --- テスト ---

describe("PaneLayout segment building", () => {
  describe("Agent パターン（メインが停止、サブエージェントのみ）", () => {
    test("サブエージェントのみの区間が parallel セグメントになる", () => {
      const items: ConvItem[] = [
        { type: "entry", entry: { timestamp: "2026-03-20T05:28:00Z", uuid: "m1" } },
        { type: "entry", entry: { timestamp: "2026-03-20T05:29:00Z", uuid: "m2" } },
        {
          type: "subagent",
          group: {
            agentId: "agent1",
            entries: [
              { timestamp: "2026-03-20T05:29:12Z" },
              { timestamp: "2026-03-20T05:29:32Z" },
            ],
          },
        },
        {
          type: "subagent",
          group: {
            agentId: "agent2",
            entries: [
              { timestamp: "2026-03-20T05:29:15Z" },
              { timestamp: "2026-03-20T05:29:33Z" },
            ],
          },
        },
        { type: "entry", entry: { timestamp: "2026-03-20T05:30:00Z", uuid: "m3" } },
      ];

      const segments = buildSegments(items);
      const types = segments.map((s) => s.type);
      expect(types).toContain("parallel");
      const parallel = segments.find((s) => s.type === "parallel");
      expect((parallel as any).groups.length).toBe(2);
    });
  });

  describe("Team パターン（メインとチームメイトが並列）", () => {
    test("メインとサブエージェントが時間的に重複する場合、parallel セグメントにメインも含まれる", () => {
      const items: ConvItem[] = [
        { type: "entry", entry: { timestamp: "2026-03-20T15:00:00Z", uuid: "m1" } },
        {
          type: "subagent",
          group: {
            agentId: "teammate1",
            entries: [
              { timestamp: "2026-03-20T15:00:05Z" },
              { timestamp: "2026-03-20T15:05:00Z" },
            ],
          },
        },
        {
          type: "subagent",
          group: {
            agentId: "teammate2",
            entries: [
              { timestamp: "2026-03-20T15:00:10Z" },
              { timestamp: "2026-03-20T15:04:00Z" },
            ],
          },
        },
        // メインが並行して動いている
        { type: "entry", entry: { timestamp: "2026-03-20T15:01:00Z", uuid: "m2" } },
        { type: "entry", entry: { timestamp: "2026-03-20T15:02:00Z", uuid: "m3" } },
        { type: "entry", entry: { timestamp: "2026-03-20T15:03:00Z", uuid: "m4" } },
        // チーム終了後のメイン
        { type: "entry", entry: { timestamp: "2026-03-20T15:10:00Z", uuid: "m5" } },
      ];

      const segments = buildSegments(items);
      const parallel = segments.find((s) => s.type === "parallel");
      expect(parallel).toBeDefined();
      // parallel にメインアイテムが含まれる
      expect((parallel as any).mainItems?.length).toBeGreaterThan(0);
      // チーム終了後のメインは別セグメント
      const lastMain = segments[segments.length - 1];
      expect(lastMain.type).toBe("main");
    });

    test("メインのみの区間は main セグメントになる", () => {
      const items: ConvItem[] = [
        { type: "entry", entry: { timestamp: "2026-03-20T10:00:00Z", uuid: "m1" } },
        { type: "entry", entry: { timestamp: "2026-03-20T10:01:00Z", uuid: "m2" } },
        { type: "entry", entry: { timestamp: "2026-03-20T10:02:00Z", uuid: "m3" } },
      ];

      const segments = buildSegments(items);
      expect(segments.length).toBe(1);
      expect(segments[0].type).toBe("main");
      expect((segments[0] as any).items.length).toBe(3);
    });
  });

  describe("単独サブエージェント", () => {
    test("1つだけのサブエージェントは single-agent になる", () => {
      const items: ConvItem[] = [
        { type: "entry", entry: { timestamp: "2026-03-20T10:00:00Z", uuid: "m1" } },
        {
          type: "subagent",
          group: {
            agentId: "solo",
            entries: [{ timestamp: "2026-03-20T10:01:00Z" }],
          },
        },
        { type: "entry", entry: { timestamp: "2026-03-20T10:05:00Z", uuid: "m2" } },
      ];

      const segments = buildSegments(items);
      const singleAgent = segments.find((s) => s.type === "single-agent");
      expect(singleAgent).toBeDefined();
    });
  });
});
