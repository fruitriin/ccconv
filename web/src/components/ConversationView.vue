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
  // 各グループの「最初のエントリのタイムスタンプ」を記録して、挿入位置を決める
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
      // 最初のタイムスタンプを更新（より早いものを保持）
      if (entry.timestamp && entry.timestamp < group.firstTimestamp) {
        group.firstTimestamp = entry.timestamp
      }
    } else {
      mainEntries.push(entry)
    }
  }

  // サブエージェントグループを firstTimestamp 順にソート
  const subagentGroups = [...subagentMap.entries()].sort(
    ([, a], [, b]) => a.firstTimestamp.localeCompare(b.firstTimestamp)
  )

  const items: ConvItem[] = []
  let subagentIdx = 0

  for (const entry of mainEntries) {
    // サブエージェントグループをこのエントリの前に挿入すべきか確認
    // （typeFilter が 'all' または 'assistant' の場合のみ）
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

    // typeフィルタ
    if (typeFilter === 'user' && entry.type !== 'user') continue
    if (typeFilter === 'assistant' && entry.type !== 'assistant') continue
    // tool_resultのみのユーザーエントリはskip（typeFilter === 'all'でも）
    if (entry.type === 'user' && isToolResult(entry) && typeFilter !== 'user') continue

    const text = getTextContent(entry)

    // テキスト検索
    if (searchText && !text.toLowerCase().includes(searchText)) continue

    items.push({ type: 'entry', entry, searchText: text })
  }

  // 残ったサブエージェントグループを末尾に追加
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
  <div class="conversation-view">
    <div v-if="!state.selectedSession" class="placeholder">
      セッションを選択してください
    </div>
    <div v-else-if="state.loading && state.conversations.length === 0" class="placeholder">
      読込中...
    </div>
    <div v-else-if="displayItems.length === 0" class="placeholder">
      表示するメッセージがありません
    </div>
    <template v-else>
      <template v-for="(item, idx) in displayItems" :key="idx">
        <!-- 通常エントリ -->
        <div
          v-if="item.type === 'entry' && item.entry"
          class="message"
          :class="[item.entry.type, { 'has-tool': isToolUse(item.entry) }]"
        >
          <div class="message-meta">
            <span class="role">{{ item.entry.type === 'user' ? 'User' : 'Assistant' }}</span>
            <span class="time">{{ formatTime(item.entry.timestamp) }}</span>
            <span v-if="isToolUse(item.entry)" class="tool-info">
              🔧 {{ getToolNames(item.entry).join(', ') }}
            </span>
            <span v-if="item.entry.message?.usage" class="token-info">
              {{ item.entry.message.usage.input_tokens }}in / {{ item.entry.message.usage.output_tokens }}out
            </span>
          </div>
          <div
            class="message-body"
            v-html="highlightText(getTextContent(item.entry), state.searchText)"
          ></div>
          <div v-if="isToolUse(item.entry) && !getTextContent(item.entry)" class="message-body tool-only">
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

<style scoped>
.conversation-view {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.placeholder {
  color: var(--text-dim);
  text-align: center;
  margin-top: 40px;
  font-size: 14px;
}

.message {
  border-radius: 8px;
  padding: 10px 14px;
  max-width: 80%;
  font-size: 13px;
  line-height: 1.6;
}

.message.user {
  background: var(--user-bg);
  align-self: flex-end;
  margin-left: auto;
}

.message.assistant {
  background: var(--assistant-bg);
  align-self: flex-start;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
  flex-wrap: wrap;
}

.role {
  font-weight: 700;
  color: var(--text-dim);
}

.time {
  color: var(--text-dim);
}

.tool-info {
  color: #f0a500;
}

.token-info {
  color: var(--text-dim);
  margin-left: auto;
}

.message-body {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
}

.tool-only {
  color: var(--text-dim);
  font-style: italic;
  font-size: 12px;
}

:deep(mark) {
  background: var(--accent);
  color: white;
  border-radius: 2px;
  padding: 0 2px;
}
</style>
