<script setup lang="ts">
import { computed } from 'vue'
import type { Entry } from '../composables/useConversations'
import {
  getTextContent,
  isToolUse,
  isEmptySubagentEntry,
  getToolNames,
  formatTime,
} from '../composables/useMessageUtils'
import MessageBubble from './MessageBubble.vue'
import SubagentTree from './SubagentTree.vue'
import Tooltip from './Tooltip.vue'

// ConversationView と同じ型定義
interface SubagentGroup {
  agentId: string
  entries: Entry[]
}

interface ConvItem {
  type: 'entry' | 'subagent'
  entry?: Entry
  group?: SubagentGroup
}

type Segment =
  | { type: 'main'; items: ConvItem[] }
  | { type: 'parallel'; groups: PaneGroup[]; mainItems?: ConvItem[] }
  | { type: 'single-agent'; group: SubagentGroup }

interface PaneGroup {
  agentId: string
  entries: Entry[]
  model?: string
}

interface TimeSlot {
  time: string // "HH:MM" 形式
  entries: (Entry[] | null)[] // paneIdx ごとのエントリ（null = 空）
}

const props = withDefaults(defineProps<{
  displayItems: ConvItem[]
  searchText?: string
  anchorUuid?: string | null
  flowMode?: boolean
  syncTimeline?: boolean
}>(), {
  flowMode: false,
  syncTimeline: false,
})

const emit = defineEmits<{
  setAnchor: [uuid: string]
}>()

function getItemUuid(item: ConvItem): string {
  if (item.type === 'entry' && item.entry) {
    return item.entry.uuid ?? item.entry.timestamp ?? ''
  }
  if (item.type === 'subagent' && item.group) {
    return 'subagent-' + item.group.agentId
  }
  return ''
}

function getGroupModel(entries: Entry[]): string {
  const assistantEntry = entries.find(e => e.type === 'assistant' && e.message?.model)
  return assistantEntry?.message?.model?.split('-').slice(0, 2).join('-') ?? 'unknown'
}

// タイムスタンプ範囲が重複するか判定
function rangesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string
): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

// displayItems をセグメントに分割
const segments = computed<Segment[]>(() => {
  const result: Segment[] = []

  // サブエージェントグループを収集
  const subagentItems = props.displayItems.filter(item => item.type === 'subagent' && item.group)
  const mainItems = props.displayItems.filter(item => item.type === 'entry')

  // 各サブエージェントグループの時間範囲を計算
  interface GroupRange {
    agentId: string
    entries: Entry[]
    start: string
    end: string
  }

  const groupRanges: GroupRange[] = subagentItems.map(item => {
    const group = item.group!
    const timestamps = group.entries
      .map(e => e.timestamp ?? '')
      .filter(Boolean)
      .sort()
    return {
      agentId: group.agentId,
      entries: group.entries,
      start: timestamps[0] ?? '',
      end: timestamps[timestamps.length - 1] ?? '',
    }
  })

  // 全アイテムを時系列に走査
  // サブエージェントグループをメインの時系列に差し込む
  const allEvents: Array<{ kind: 'main'; item: ConvItem } | { kind: 'group'; range: GroupRange }> = []

  for (const item of mainItems) {
    allEvents.push({ kind: 'main', item })
  }
  for (const gr of groupRanges) {
    allEvents.push({ kind: 'group', range: gr })
  }

  // start タイムスタンプでソート（グループは start、メインは timestamp）
  allEvents.sort((a, b) => {
    const ta = a.kind === 'main' ? (a.item.entry?.timestamp ?? '') : a.range.start
    const tb = b.kind === 'main' ? (b.item.entry?.timestamp ?? '') : b.range.start
    return ta.localeCompare(tb)
  })

  let currentMainItems: ConvItem[] = []
  let pendingGroups: GroupRange[] = []
  let parallelMainItems: ConvItem[] = []

  function flushMainItems() {
    if (currentMainItems.length > 0) {
      result.push({ type: 'main', items: [...currentMainItems] })
      currentMainItems = []
    }
  }

  function flushPending() {
    if (pendingGroups.length === 0) return
    if (pendingGroups.length === 1 && parallelMainItems.length === 0) {
      result.push({
        type: 'single-agent',
        group: { agentId: pendingGroups[0].agentId, entries: pendingGroups[0].entries },
      })
    } else {
      result.push({
        type: 'parallel',
        groups: pendingGroups.map(gr => ({
          agentId: gr.agentId,
          entries: gr.entries,
          model: getGroupModel(gr.entries),
        })),
        mainItems: parallelMainItems.length > 0 ? [...parallelMainItems] : undefined,
      })
    }
    pendingGroups = []
    parallelMainItems = []
  }

  // Team 対応: メインが pending サブエージェントと時間的に重複するか
  function mainOverlapsWithPending(ts: string): boolean {
    if (!ts || pendingGroups.length === 0) return false
    return pendingGroups.some(pg => ts >= pg.start && ts <= pg.end)
  }

  for (const event of allEvents) {
    if (event.kind === 'main') {
      const ts = event.item.entry?.timestamp ?? ''
      if (mainOverlapsWithPending(ts)) {
        // メインがサブエージェントと並列（Team パターン）
        parallelMainItems.push(event.item)
      } else {
        // メインが単独
        if (pendingGroups.length > 0) {
          flushPending()
        }
        currentMainItems.push(event.item)
      }
    } else {
      const gr = event.range

      if (pendingGroups.length === 0) {
        // 現在のメインアイテムがこのグループと重複するか
        const mainOverlaps = currentMainItems.some(item =>
          item.entry?.timestamp && rangesOverlap(item.entry.timestamp, item.entry.timestamp, gr.start, gr.end)
        )
        if (mainOverlaps) {
          parallelMainItems.push(...currentMainItems)
          currentMainItems = []
        } else {
          flushMainItems()
        }
        pendingGroups.push(gr)
      } else {
        const overlaps = pendingGroups.some(pg =>
          rangesOverlap(pg.start, pg.end, gr.start, gr.end)
        )
        if (overlaps) {
          pendingGroups.push(gr)
        } else {
          flushPending()
          pendingGroups.push(gr)
        }
      }
    }
  }

  // 残りをフラッシュ
  if (pendingGroups.length > 0) {
    flushPending()
  }
  flushMainItems()

  return result
})

// グリッドクラスを返す（ペイン数に応じて）
function paneGridClass(count: number): string {
  if (count <= 1) return 'flex gap-2'
  if (count <= 3) return 'flex gap-2'
  // 4ペイン以上は2列グリッド
  return 'grid grid-cols-2 gap-2'
}

// タイムライン同期ロジック
function buildTimeSlots(groups: PaneGroup[], mainItems?: ConvItem[]): TimeSlot[] {
  const allPanes: { entries: Entry[] }[] = mainItems && mainItems.length > 0
    ? [{ entries: mainItems.map(i => i.entry!).filter(Boolean) }, ...groups]
    : [...groups]

  const timeMap = new Map<string, (Entry[] | null)[]>()

  for (let pIdx = 0; pIdx < allPanes.length; pIdx++) {
    for (const entry of allPanes[pIdx].entries) {
      if (isEmptySubagentEntry(entry)) continue
      const time = entry.timestamp?.split('T')[1]?.slice(0, 5) ?? ''
      if (!time) continue
      if (!timeMap.has(time)) {
        timeMap.set(time, Array(allPanes.length).fill(null))
      }
      const slot = timeMap.get(time)!
      if (!slot[pIdx]) slot[pIdx] = []
      slot[pIdx]!.push(entry)
    }
  }

  return [...timeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, entries]) => ({ time, entries }))
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
    <template v-for="(seg, si) in segments" :key="si">
      <!-- メイン会話 -->
      <template v-if="seg.type === 'main'">
        <div
          v-for="(item, idx) in seg.items"
          :key="getItemUuid(item)"
          :data-uuid="getItemUuid(item)"
          @click="emit('setAnchor', getItemUuid(item))"
          :class="anchorUuid === getItemUuid(item) ? 'ring-1 ring-accent rounded-lg' : ''"
        >
          <MessageBubble
            v-if="item.type === 'entry' && item.entry"
            :entry="item.entry"
            :search-text="searchText ?? ''"
            :idx="idx"
          />
        </div>
      </template>

      <!-- 並列サブエージェント = ペイン分割 -->
      <template v-else-if="seg.type === 'parallel'">
        <!-- タイムライン同期モード -->
        <div
          v-if="syncTimeline"
          class="border border-white/10 rounded-md overflow-hidden"
        >
          <!-- ペインヘッダー行 -->
          <div
            class="grid border-b border-white/10 bg-surface2"
            :style="{ gridTemplateColumns: `4rem repeat(${seg.groups.length + (seg.mainItems?.length ? 1 : 0)}, 1fr)` }"
          >
            <!-- 時刻ラベル列ヘッダー -->
            <div class="px-2 py-1.5 text-[10px] text-text-dim flex items-center justify-center border-r border-white/10">
              HH:MM
            </div>
            <!-- メインペインヘッダー -->
            <div
              v-if="seg.mainItems && seg.mainItems.length > 0"
              class="px-2 py-1.5 bg-accent/10 text-xs text-accent font-semibold border-r border-white/10 last:border-r-0"
            >
              👑 Main
            </div>
            <!-- サブエージェントペインヘッダー -->
            <div
              v-for="pane in seg.groups"
              :key="pane.agentId"
              class="px-2 py-1.5 bg-[rgba(233,69,96,0.1)] text-xs text-accent font-semibold flex items-center gap-1.5 border-r border-white/10 last:border-r-0"
            >
              <span>🤖 {{ pane.agentId.slice(0, 8) }}</span>
              <span class="text-text-dim">({{ pane.model }})</span>
            </div>
          </div>
          <!-- タイムスロット行 -->
          <template v-for="slot in buildTimeSlots(seg.groups, seg.mainItems)" :key="slot.time">
            <div
              class="grid border-b border-white/5 last:border-b-0"
              :style="{ gridTemplateColumns: `4rem repeat(${seg.groups.length + (seg.mainItems?.length ? 1 : 0)}, 1fr)` }"
            >
              <!-- 時刻ラベル -->
              <div class="px-2 py-1 flex items-start justify-center border-r border-white/10 bg-black/10">
                <span class="text-[10px] text-text-dim font-mono opacity-60 mt-1">{{ slot.time }}</span>
              </div>
              <!-- 各ペインのエントリ -->
              <div
                v-for="(entries, pIdx) in slot.entries"
                :key="pIdx"
                class="border-r border-white/5 last:border-r-0"
                :class="flowMode ? 'p-2 min-h-10' : 'p-1 min-h-8'"
              >
                <template v-if="entries && entries.length > 0">
                  <div
                    v-for="entry in entries"
                    :key="entry.uuid ?? entry.timestamp"
                    :data-uuid="entry.uuid"
                    @click="entry.uuid && emit('setAnchor', entry.uuid)"
                    class="rounded mb-1.5 last:mb-0"
                    :class="[
                      anchorUuid === entry.uuid ? 'ring-1 ring-accent' : '',
                      flowMode ? 'p-2.5 text-[13px]' : 'p-1.5 text-[12px]',
                      entry.type === 'user' ? 'bg-[rgba(26,58,92,0.6)]' : 'bg-[rgba(42,42,62,0.8)]'
                    ]"
                  >
                    <div class="flex items-center gap-1.5 mb-1" :class="flowMode ? 'text-[11px]' : 'text-[10px]'">
                      <span class="font-semibold text-text-dim">{{ entry.type === 'user' ? 'User' : 'Assistant' }}</span>
                      <span class="text-text-dim">{{ formatTime(entry.timestamp) }}</span>
                      <Tooltip v-if="isToolUse(entry)" :text="getToolNames(entry).join(', ')">
                        <span class="text-[#f0a500] truncate max-w-[70%] inline-block" :class="flowMode ? 'text-[11px]' : 'text-[10px]'">
                          🔧 {{ getToolNames(entry).join(', ') }}
                        </span>
                      </Tooltip>
                    </div>
                    <div v-if="getTextContent(entry)" class="whitespace-pre-wrap break-words leading-relaxed text-text" :class="flowMode ? 'text-[13px]' : 'text-[12px]'">
                      {{ getTextContent(entry) }}
                    </div>
                    <div v-else-if="isToolUse(entry)" class="text-text-dim italic text-[11px]">
                      ツール実行
                    </div>
                  </div>
                </template>
                <!-- 空セル -->
                <div v-else class="w-full h-full flex items-start justify-center pt-2">
                  <span class="text-white/10 text-xs select-none">—</span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 通常ペインモード -->
        <div
          v-else
          :class="paneGridClass(seg.groups.length + (seg.mainItems?.length ? 1 : 0))"
          class=""
          :style="flowMode ? {} : { minHeight: '15rem' }"
        >
          <!-- メインペイン（Team パターン時） -->
          <div
            v-if="seg.mainItems && seg.mainItems.length > 0"
            class="border border-accent/40 rounded-md flex flex-col min-w-0"
            :class="flowMode ? '' : 'flex-1 overflow-hidden'"
          >
            <div class="px-2 py-1.5 bg-accent/10 text-xs text-accent font-semibold flex-shrink-0">
              👑 Main
            </div>
            <div
              class="p-2 flex flex-col gap-1.5 bg-black/10"
              :class="flowMode ? '' : 'flex-1 overflow-y-auto max-h-[50vh]'"
            >
              <div
                v-for="item in seg.mainItems"
                :key="getItemUuid(item)"
                :data-uuid="getItemUuid(item)"
                @click="emit('setAnchor', getItemUuid(item))"
              >
                <MessageBubble
                  v-if="item.entry"
                  :entry="item.entry"
                  :search-text="searchText ?? ''"
                  :idx="0"
                />
              </div>
            </div>
          </div>
          <!-- サブエージェントペイン -->
          <div
            v-for="pane in seg.groups"
            :key="pane.agentId"
            class="border border-subagent-border rounded-md flex flex-col min-w-0"
            :class="flowMode ? '' : 'flex-1 overflow-hidden'"
          >
            <!-- ペインヘッダー -->
            <div class="px-2 py-1.5 bg-[rgba(233,69,96,0.1)] text-xs text-accent font-semibold flex items-center gap-1.5 flex-shrink-0">
              <span>🤖 {{ pane.agentId.slice(0, 8) }}</span>
              <span class="text-text-dim">({{ pane.model }})</span>
            </div>
            <!-- ペインボディ -->
            <div
              class="p-2 flex flex-col gap-1.5 bg-black/20"
              :class="flowMode ? '' : 'flex-1 overflow-y-auto max-h-[50vh]'"
            >
              <template v-for="entry in pane.entries" :key="entry.uuid ?? entry.timestamp">
                <div
                  v-if="!isEmptySubagentEntry(entry)"
                  :data-uuid="entry.uuid"
                  @click="entry.uuid && emit('setAnchor', entry.uuid)"
                  class="rounded-md p-2 text-[13px]"
                  :class="[
                    anchorUuid === entry.uuid ? 'ring-1 ring-accent' : '',
                    entry.type === 'user' ? 'bg-[rgba(26,58,92,0.6)] self-end max-w-[85%]' : 'bg-[rgba(42,42,62,0.8)] self-start max-w-[85%]'
                  ]"
                >
                  <div class="flex items-center gap-2 mb-1 text-[11px]">
                    <span class="font-semibold text-text-dim">{{ entry.type === 'user' ? 'User' : 'Assistant' }}</span>
                    <span class="text-text-dim">{{ formatTime(entry.timestamp) }}</span>
                    <Tooltip v-if="isToolUse(entry)" :text="getToolNames(entry).join(', ')">
                      <span class="text-[#f0a500] text-[11px] truncate max-w-[60%] inline-block">
                        🔧 {{ getToolNames(entry).join(', ') }}
                      </span>
                    </Tooltip>
                  </div>
                  <div v-if="getTextContent(entry)" class="whitespace-pre-wrap break-words leading-relaxed text-text">
                    {{ getTextContent(entry) }}
                  </div>
                  <div v-else-if="isToolUse(entry)" class="text-text-dim italic text-xs">
                    ツール実行
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- 単独サブエージェント -->
      <SubagentTree
        v-else-if="seg.type === 'single-agent'"
        :entries="seg.group.entries"
        :agent-id="seg.group.agentId"
        :default-expanded="false"
      />
    </template>
  </div>
</template>
