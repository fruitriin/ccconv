<script setup lang="ts">
import { computed } from 'vue'
import { useConversations } from '../composables/useConversations'
import type { Entry } from '../composables/useConversations'
import SubagentTree from './SubagentTree.vue'

const { state } = useConversations()

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
  // フィルタ用テキスト
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

function isToolResult(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  return content.some(c => c.type === 'tool_result')
}

function isToolUse(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  return content.some(c => c.type === 'tool_use')
}

function getToolNames(entry: Entry): string[] {
  const content = entry.message?.content
  if (!Array.isArray(content)) return []
  return content.filter(c => c.type === 'tool_use').map(c => c.name ?? '(tool)')
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// 表示用アイテムリスト
const displayItems = computed<ConvItem[]>(() => {
  const entries = state.conversations
  const typeFilter = state.typeFilter
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
    if (typeFilter === 'all' || typeFilter === 'assistant') {
      while (
        subagentIdx < subagentGroups.length &&
        entry.timestamp &&
        subagentGroups[subagentIdx][1].firstTimestamp < entry.timestamp
      ) {
        const [agentId, group] = subagentGroups[subagentIdx]
        items.push({ type: 'subagent', group: { agentId, entries: group.entries } })
        subagentIdx++
      }
    }

    if (typeFilter === 'user' && entry.type !== 'user') continue
    if (typeFilter === 'assistant' && entry.type !== 'assistant') continue
    if (entry.type === 'user' && isToolResult(entry) && typeFilter !== 'user') continue

    const text = getTextContent(entry)

    if (searchText && !text.toLowerCase().includes(searchText)) continue

    items.push({ type: 'entry', entry, searchText: text })
  }

  if (typeFilter === 'all' || typeFilter === 'assistant') {
    while (subagentIdx < subagentGroups.length) {
      const [agentId, group] = subagentGroups[subagentIdx]
      items.push({ type: 'subagent', group: { agentId, entries: group.entries } })
      subagentIdx++
    }
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
        <div
          v-if="item.type === 'entry' && item.entry"
          class="rounded-lg px-3.5 py-2.5 max-w-[80%] text-[13px] leading-relaxed"
          :class="item.entry.type === 'user'
            ? 'bg-user-bg self-end ml-auto'
            : 'bg-assistant-bg self-start'"
        >
          <div class="flex items-center gap-2 mb-1.5 text-[11px] flex-wrap">
            <span class="font-bold text-text-dim">{{ item.entry.type === 'user' ? 'User' : 'Assistant' }}</span>
            <span class="text-text-dim">{{ formatTime(item.entry.timestamp) }}</span>
            <span v-if="isToolUse(item.entry)" class="text-[#f0a500]">
              🔧 {{ getToolNames(item.entry).join(', ') }}
            </span>
            <span v-if="item.entry.message?.usage" class="text-text-dim ml-auto">
              {{ item.entry.message.usage.input_tokens }}in / {{ item.entry.message.usage.output_tokens }}out
            </span>
          </div>
          <div
            class="whitespace-pre-wrap break-words text-text"
            v-html="highlightText(getTextContent(item.entry), state.searchText)"
          ></div>
          <div v-if="isToolUse(item.entry) && !getTextContent(item.entry)" class="text-text-dim italic text-xs">
            ツール実行のみ
          </div>
        </div>
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
