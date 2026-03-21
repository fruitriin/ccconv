<script setup lang="ts">
import { computed } from 'vue'
import type { Entry } from '../composables/useConversations'
import {
  getTextContent,
  isToolUse,
  getToolNames,
  formatTime,
} from '../composables/useMessageUtils'
import MessageBubble from './MessageBubble.vue'
import SubagentTree from './SubagentTree.vue'

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
  | { type: 'parallel'; groups: PaneGroup[] }
  | { type: 'single-agent'; group: SubagentGroup }

interface PaneGroup {
  agentId: string
  entries: Entry[]
  description?: string
  model?: string
}

const props = defineProps<{
  displayItems: ConvItem[]
  searchText?: string
  anchorUuid?: string | null
}>()

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

function getGroupDescription(entries: Entry[]): string | undefined {
  // agentId を持つエントリの親セッションから Agent tool_use の description を取得
  // entries の中に description はないため、agentId から推測不可。空でよい
  return undefined
}

function isToolResult(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  return content.some(c => c.type === 'tool_result')
}

function isEmptyEntry(entry: Entry): boolean {
  const text = getTextContent(entry)
  if (text.trim()) return false
  if (isToolUse(entry)) return false
  if (isToolResult(entry) && !text.trim()) return true
  const content = entry.message?.content
  if (!content) return true
  if (typeof content === 'string' && !content.trim()) return true
  if (Array.isArray(content) && content.length === 0) return true
  if (Array.isArray(content) && content.every(c =>
    (c.type === 'text' && !c.text?.trim()) ||
    (c.type === 'tool_result')
  )) return true
  return false
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

  // メインアイテムのタイムスタンプリスト（挿入ポイント計算用）
  const mainTimestamps = mainItems.map(item => item.entry?.timestamp ?? '')

  // 処理済みグループを追跡
  const processedAgentIds = new Set<string>()
  // メインアイテムの処理済みインデックス
  let mainIdx = 0

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

  // 現在積み上げているメインアイテム
  let currentMainItems: ConvItem[] = []

  // 並列グループを判定してセグメント化
  // サブエージェントグループが複数連続し、タイムスタンプが重複する場合は parallel
  let pendingGroups: GroupRange[] = []

  function flushMainItems() {
    if (currentMainItems.length > 0) {
      result.push({ type: 'main', items: [...currentMainItems] })
      currentMainItems = []
    }
  }

  function flushPendingGroups() {
    if (pendingGroups.length === 0) return
    if (pendingGroups.length === 1) {
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
          description: getGroupDescription(gr.entries),
        })),
      })
    }
    pendingGroups = []
  }

  for (const event of allEvents) {
    if (event.kind === 'main') {
      // メインアイテムが来たら、溜まっているグループを先にフラッシュ
      flushPendingGroups()
      currentMainItems.push(event.item)
    } else {
      // グループが来たら、溜まっているメインアイテムをフラッシュ
      flushMainItems()

      // 既存の pending グループと時間的に重複するかチェック
      const gr = event.range
      if (pendingGroups.length === 0) {
        pendingGroups.push(gr)
      } else {
        // 最後の pending グループと重複チェック
        const lastGr = pendingGroups[pendingGroups.length - 1]
        // 重複: 少なくとも一つの pending グループと重複していれば並列
        const overlaps = pendingGroups.some(pg =>
          rangesOverlap(pg.start, pg.end, gr.start, gr.end)
        )
        if (overlaps) {
          pendingGroups.push(gr)
        } else {
          // 重複しない → 今までの pending をフラッシュして新規開始
          flushPendingGroups()
          pendingGroups.push(gr)
        }
      }
    }
  }

  flushMainItems()
  flushPendingGroups()

  return result
})

// グリッドクラスを返す（ペイン数に応じて）
function paneGridClass(count: number): string {
  if (count <= 1) return 'flex gap-2'
  if (count <= 3) return 'flex gap-2'
  // 4ペイン以上は2列グリッド
  return 'grid grid-cols-2 gap-2'
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
      <div
        v-else-if="seg.type === 'parallel'"
        :class="paneGridClass(seg.groups.length)"
        class="min-h-60"
      >
        <div
          v-for="pane in seg.groups"
          :key="pane.agentId"
          class="flex-1 border border-subagent-border rounded-md flex flex-col overflow-hidden min-w-0"
        >
          <!-- ペインヘッダー -->
          <div class="px-2 py-1.5 bg-[rgba(233,69,96,0.1)] text-xs text-accent font-semibold flex items-center gap-1.5 flex-shrink-0">
            <span>🤖 {{ pane.agentId.slice(0, 8) }}</span>
            <span class="text-text-dim">({{ pane.model }})</span>
            <span v-if="pane.description" class="text-text-dim truncate">{{ pane.description }}</span>
          </div>
          <!-- ペインボディ -->
          <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 bg-black/20 max-h-[50vh]">
            <template v-for="entry in pane.entries" :key="entry.uuid ?? entry.timestamp">
              <div
                v-if="!isEmptyEntry(entry)"
                class="rounded-md p-2 text-[13px]"
                :class="entry.type === 'user'
                  ? 'bg-[rgba(26,58,92,0.6)] self-end max-w-[85%]'
                  : 'bg-[rgba(42,42,62,0.8)] self-start max-w-[85%]'"
              >
                <div class="flex items-center gap-2 mb-1 text-[11px]">
                  <span class="font-semibold text-text-dim">{{ entry.type === 'user' ? 'User' : 'Assistant' }}</span>
                  <span class="text-text-dim">{{ formatTime(entry.timestamp) }}</span>
                  <span v-if="isToolUse(entry)" class="text-[#f0a500] text-[11px]">
                    🔧 {{ getToolNames(entry).join(', ') }}
                  </span>
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
