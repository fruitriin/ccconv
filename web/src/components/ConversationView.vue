<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConversations } from '../composables/useConversations'
import type { Entry, MessageContent } from '../composables/useConversations'
import SubagentTree from './SubagentTree.vue'

const { state, filteredConversations, isHook, isToolResultEntry } = useConversations()

// サブエージェントエントリをagentIdでグループ化
interface SubagentGroup {
  agentId: string
  entries: Entry[]
}

// メインの会話エントリ（サブエージェントを除く）+ サブエージェントグループのリスト
interface ConvItem {
  type: 'entry' | 'subagent'
  entry?: Entry
  group?: SubagentGroup
  searchText?: string
}

function getTextContent(entry: Entry): string {
  const content = entry.message?.content
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text ?? '')
      .join('\n')
  }
  return ''
}

function isToolUse(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  return content.some(c => c.type === 'tool_use')
}

function hasOnlyToolUse(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  const hasText = content.some(c => c.type === 'text' && c.text?.trim())
  const hasToolUse = content.some(c => c.type === 'tool_use')
  return hasToolUse && !hasText
}

function getToolUseItems(entry: Entry): MessageContent[] {
  const content = entry.message?.content
  if (!Array.isArray(content)) return []
  return content.filter(c => c.type === 'tool_use')
}

function getToolNames(entry: Entry): string[] {
  return getToolUseItems(entry).map(c => c.name ?? '(tool)')
}

function getToolSummary(tool: MessageContent): string {
  const name = tool.name ?? '(tool)'
  const input = tool.input
  if (!input || typeof input !== 'object') return name
  const keys = Object.keys(input)
  if (keys.length === 0) return name
  const firstKey = keys[0]
  let val = input[firstKey]
  if (typeof val === 'string' && val.length > 50) val = val.slice(0, 50) + '...'
  return `${name}(${firstKey}=${JSON.stringify(val)})`
}

function getThinkingItems(entry: Entry): MessageContent[] {
  const content = entry.message?.content
  if (!Array.isArray(content)) return []
  return content.filter(c => c.type === 'thinking')
}

function hasThinkingOnly(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  const hasText = content.some(c => c.type === 'text' && c.text?.trim())
  const hasToolUse = content.some(c => c.type === 'tool_use')
  const hasThinking = content.some(c => c.type === 'thinking')
  return hasThinking && !hasText && !hasToolUse
}

function isEmptyEntry(entry: Entry): boolean {
  const text = getTextContent(entry)
  if (text.trim()) return false
  if (isToolUse(entry)) return false
  if (hasThinkingOnly(entry)) return false
  if (isHook(entry)) return false
  if (isToolResultEntry(entry)) return false
  // content が全くないか、空の配列
  const content = entry.message?.content
  if (!content) return true
  if (Array.isArray(content) && content.length === 0) return true
  // type が text だが中身が空
  if (Array.isArray(content) && content.every(c =>
    (c.type === 'text' && !c.text?.trim()) ||
    (c.type !== 'text' && c.type !== 'tool_use' && c.type !== 'thinking' && c.type !== 'tool_result')
  )) return true
  return false
}

function getHookPreview(entry: Entry): string {
  const content = entry.message?.content
  if (typeof content === 'string') {
    const match = content.match(/<system-reminder>([\s\S]*?)<\/system-reminder>/)
    if (match) return match[1].trim().slice(0, 120)
    return content.slice(0, 120)
  }
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === 'text' && c.text?.includes('<system-reminder>')) {
        const match = c.text.match(/<system-reminder>([\s\S]*?)<\/system-reminder>/)
        if (match) return match[1].trim().slice(0, 120)
      }
    }
  }
  return ''
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const LONG_MESSAGE_THRESHOLD = 300 // 文字数
const LONG_MESSAGE_LINES = 5      // 行数

function isLongMessage(entry: Entry): boolean {
  const text = getTextContent(entry)
  return text.length > LONG_MESSAGE_THRESHOLD || text.split('\n').length > LONG_MESSAGE_LINES
}

function getPreview(text: string): string {
  const lines = text.split('\n')
  if (lines.length > LONG_MESSAGE_LINES) {
    return lines.slice(0, LONG_MESSAGE_LINES).join('\n')
  }
  return text.slice(0, LONG_MESSAGE_THRESHOLD)
}

// 折りたたみ状態管理
const collapsedThinking = ref<Set<number>>(new Set())
const expandedLong = ref<Set<number>>(new Set())

function toggleLong(idx: number) {
  if (expandedLong.value.has(idx)) {
    expandedLong.value.delete(idx)
  } else {
    expandedLong.value.add(idx)
  }
}

function toggleThinking(idx: number) {
  if (collapsedThinking.value.has(idx)) {
    collapsedThinking.value.delete(idx)
  } else {
    collapsedThinking.value.add(idx)
  }
}

// 表示用アイテムリスト
const displayItems = computed<ConvItem[]>(() => {
  const entries = filteredConversations.value
  const searchText = state.searchText.toLowerCase()

  // サブエージェントをグループ化（agentId → entries）
  const subagentMap = new Map<string, { entries: Entry[]; firstTimestamp: string }>()
  const mainEntries: Entry[] = []

  for (const entry of entries) {
    if (entry._isSubagent && entry._agentId) {
      const id = entry._agentId
      if (!subagentMap.has(id)) {
        subagentMap.set(id, { entries: [], firstTimestamp: entry.timestamp ?? '' })
      }
      const group = subagentMap.get(id)!
      group.entries.push(entry)
      if (entry.timestamp && entry.timestamp < group.firstTimestamp) {
        group.firstTimestamp = entry.timestamp
      }
    } else {
      mainEntries.push(entry)
    }
  }

  const subagentGroups = [...subagentMap.entries()].sort(
    ([, a], [, b]) => a.firstTimestamp.localeCompare(b.firstTimestamp)
  )

  const items: ConvItem[] = []
  let subagentIdx = 0

  for (const entry of mainEntries) {
    // サブエージェントを時系列に挿入
    while (
      subagentIdx < subagentGroups.length &&
      entry.timestamp &&
      subagentGroups[subagentIdx][1].firstTimestamp < entry.timestamp
    ) {
      const [agentId, group] = subagentGroups[subagentIdx]
      items.push({ type: 'subagent', group: { agentId, entries: group.entries } })
      subagentIdx++
    }

    const text = getTextContent(entry)

    if (searchText && !text.toLowerCase().includes(searchText)) continue

    items.push({ type: 'entry', entry, searchText: text })
  }

  while (subagentIdx < subagentGroups.length) {
    const [agentId, group] = subagentGroups[subagentIdx]
    items.push({ type: 'subagent', group: { agentId, entries: group.entries } })
    subagentIdx++
  }

  return items
})

function highlightText(text: string, search: string): string {
  if (!search) return text
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(escaped, 'gi'), m => `<mark>${m}</mark>`)
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
    <div v-if="!state.selectedSession" class="text-text-dim text-center mt-10 text-sm">
      セッションを選択してください
    </div>
    <div v-else-if="state.loading && state.conversations.length === 0" class="text-text-dim text-center mt-10 text-sm">
      読込中...
    </div>
    <div v-else-if="displayItems.length === 0" class="text-text-dim text-center mt-10 text-sm">
      表示するメッセージがありません
    </div>
    <template v-else>
      <template v-for="(item, idx) in displayItems" :key="idx">
        <!-- 通常エントリ -->
        <template v-if="item.type === 'entry' && item.entry">
          <!-- Hook エントリ -->
          <div
            v-if="isHook(item.entry)"
            class="rounded-lg px-3 py-1.5 text-text-dim text-xs self-start bg-surface2 max-w-[80%] border border-[#333]"
          >
            <span class="mr-1">📡</span>
            <span class="font-mono">[system-reminder]</span>
            <span class="ml-1">{{ getHookPreview(item.entry) }}...</span>
          </div>

          <!-- Tool Result エントリ -->
          <div
            v-else-if="isToolResultEntry(item.entry)"
            class="rounded-lg px-3 py-1.5 text-text-dim text-xs self-start bg-surface2 max-w-[80%] border border-[#333]"
          >
            <div class="flex items-center gap-1.5 mb-0.5 text-[11px]">
              <span class="text-[#f0a500]">🔧</span>
              <span class="text-text-dim">Tool Result</span>
              <span class="text-text-dim">{{ formatTime(item.entry.timestamp) }}</span>
            </div>
            <div class="whitespace-pre-wrap break-words text-text-dim truncate max-h-16 overflow-hidden">
              {{ getTextContent(item.entry) || '(no text content)' }}
            </div>
          </div>

          <!-- Thinking のみのエントリ -->
          <div
            v-else-if="hasThinkingOnly(item.entry)"
            class="rounded-lg px-3 py-1.5 text-xs self-start bg-surface2 max-w-[80%] border border-[#333]"
          >
            <button
              class="flex items-center gap-1.5 w-full text-left cursor-pointer bg-transparent border-none p-0"
              @click="toggleThinking(idx)"
            >
              <span>💭</span>
              <span class="italic text-text-dim">
                {{ collapsedThinking.has(idx)
                  ? (getThinkingItems(item.entry)[0]?.thinking?.slice(0, 100) ?? '') + '...'
                  : '(thinking — クリックで展開)' }}
              </span>
              <span class="ml-auto text-text-dim">{{ collapsedThinking.has(idx) ? '▾' : '▸' }}</span>
            </button>
            <div v-if="collapsedThinking.has(idx)" class="mt-1.5 italic text-text-dim whitespace-pre-wrap break-words text-[12px]">
              <div v-for="(t, ti) in getThinkingItems(item.entry)" :key="ti">
                {{ t.thinking }}
              </div>
            </div>
          </div>

          <!-- 通常メッセージ（空エントリは非表示） -->
          <div
            v-else-if="!isEmptyEntry(item.entry)"
            class="rounded-lg px-3.5 py-2.5 max-w-[80%] text-[13px] leading-relaxed"
            :class="item.entry.type === 'user'
              ? 'bg-user-bg self-end ml-auto'
              : 'bg-assistant-bg self-start'"
          >
            <div class="flex items-center gap-2 mb-1.5 text-[11px] flex-wrap">
              <span class="font-bold text-text-dim">{{ item.entry.type === 'user' ? 'User' : 'Assistant' }}</span>
              <span class="text-text-dim">{{ formatTime(item.entry.timestamp) }}</span>
              <span v-if="item.entry.message?.usage" class="text-text-dim ml-auto">
                {{ item.entry.message.usage.input_tokens }}in / {{ item.entry.message.usage.output_tokens }}out
              </span>
            </div>

            <!-- テキストコンテンツ -->
            <template v-if="getTextContent(item.entry)">
              <!-- 長いメッセージ（折りたたみ） -->
              <template v-if="isLongMessage(item.entry) && !expandedLong.has(idx)">
                <div
                  class="whitespace-pre-wrap break-words text-text"
                  v-html="highlightText(getPreview(getTextContent(item.entry)), state.searchText)"
                ></div>
                <button
                  class="mt-1 text-accent text-xs cursor-pointer bg-transparent border-none p-0 hover:underline"
                  @click="toggleLong(idx)"
                >
                  ▸ 続きを表示（{{ getTextContent(item.entry).length }}文字）
                </button>
              </template>
              <!-- 通常 or 展開済み -->
              <template v-else>
                <div
                  class="whitespace-pre-wrap break-words text-text"
                  v-html="highlightText(getTextContent(item.entry), state.searchText)"
                ></div>
                <button
                  v-if="isLongMessage(item.entry)"
                  class="mt-1 text-accent text-xs cursor-pointer bg-transparent border-none p-0 hover:underline"
                  @click="toggleLong(idx)"
                >
                  ▾ 折りたたむ
                </button>
              </template>
            </template>

            <!-- ツール実行（テキストなし） -->
            <div v-if="hasOnlyToolUse(item.entry)" class="flex flex-col gap-1 mt-1">
              <div
                v-for="(tool, ti) in getToolUseItems(item.entry)"
                :key="ti"
                class="text-[#f0a500] text-xs font-mono"
              >
                🔧 {{ getToolSummary(tool) }}
              </div>
            </div>

            <!-- テキストあり + ツールあり の場合はツール名を補足表示 -->
            <div v-else-if="isToolUse(item.entry) && getTextContent(item.entry)" class="mt-1.5 flex flex-wrap gap-1.5">
              <span
                v-for="(tool, ti) in getToolUseItems(item.entry)"
                :key="ti"
                class="text-[#f0a500] text-xs font-mono"
              >
                🔧 {{ getToolSummary(tool) }}
              </span>
            </div>
          </div>
        </template>

        <!-- サブエージェントグループ -->
        <SubagentTree
          v-else-if="item.type === 'subagent' && item.group"
          :entries="item.group.entries"
          :agent-id="item.group.agentId"
        />
      </template>
    </template>
  </div>
</template>
