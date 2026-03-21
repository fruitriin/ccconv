<script setup lang="ts">
import { computed } from 'vue'
import { useConversations } from '../composables/useConversations'
import type { Entry } from '../composables/useConversations'
import { getTextContent } from '../composables/useMessageUtils'
import SubagentTree from './SubagentTree.vue'
import MessageBubble from './MessageBubble.vue'

const { state, filteredConversations } = useConversations()

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

    items.push({ type: 'entry', entry })
  }

  while (subagentIdx < subagentGroups.length) {
    const [agentId, group] = subagentGroups[subagentIdx]
    items.push({ type: 'subagent', group: { agentId, entries: group.entries } })
    subagentIdx++
  }

  return items
})
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
        <MessageBubble
          v-if="item.type === 'entry' && item.entry"
          :entry="item.entry"
          :search-text="state.searchText"
          :idx="idx"
        />
        <SubagentTree
          v-else-if="item.type === 'subagent' && item.group"
          :entries="item.group.entries"
          :agent-id="item.group.agentId"
        />
      </template>
    </template>
  </div>
</template>
