<script setup lang="ts">
import { computed, watch, nextTick, ref } from 'vue'
import { useConversations } from '../composables/useConversations'
import type { Entry } from '../composables/useConversations'
import { getTextContent } from '../composables/useMessageUtils'
import SubagentTree from './SubagentTree.vue'
import MessageBubble from './MessageBubble.vue'

const { state, filteredConversations } = useConversations()

const containerRef = ref<HTMLElement | null>(null)

// サブエージェントエントリをagentIdでグループ化
interface SubagentGroup {
  agentId: string
  entries: Entry[]
}

interface ConvItem {
  type: 'entry' | 'subagent'
  entry?: Entry
  group?: SubagentGroup
}

function getItemUuid(item: ConvItem): string {
  if (item.type === 'entry' && item.entry) {
    return item.entry.uuid ?? item.entry.timestamp ?? ''
  }
  if (item.type === 'subagent' && item.group) {
    return 'subagent-' + item.group.agentId
  }
  return ''
}

function setAnchor(uuid: string) {
  state.anchorUuid = uuid
}

// フィルタ変更前に、現在画面内の先頭要素の uuid リストを記憶
let visibleUuids: string[] = []

function captureVisibleUuids() {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const elements = container.querySelectorAll<HTMLElement>('[data-uuid]')
  visibleUuids = []
  for (const el of elements) {
    const elRect = el.getBoundingClientRect()
    // 要素の上端がコンテナの表示範囲内にあるか
    if (elRect.top >= rect.top && elRect.top < rect.bottom) {
      visibleUuids.push(el.dataset.uuid!)
    }
  }
}

function findScrollTarget(): string | null {
  // 1. 明示的アンカーが画面に存在するか
  if (state.anchorUuid) {
    const el = document.querySelector(`[data-uuid="${state.anchorUuid}"]`)
    if (el) return state.anchorUuid
  }

  // 2. 記憶した画面内要素のうち、まだ存在するものを探す（上から順）
  for (const uuid of visibleUuids) {
    const el = document.querySelector(`[data-uuid="${uuid}"]`)
    if (el) return uuid
  }

  // 3. 全要素を走査し、記憶した先頭要素のタイムスタンプに最も近い要素を探す
  // （フォールバック: 何も見つからなければスクロールしない）
  return null
}

// フィルタ変更時：watch は reactive 値の変更後・DOM 更新前に呼ばれる
// → captureVisibleUuids() で旧DOMの画面内要素を取得できる
// → nextTick() で新DOMに切り替わった後にスクロール先を探す
watch(
  () => JSON.stringify([state.filters.tools, state.filters.thinking, state.filters.subagents, state.filters.hooks, state.filters.user, state.filters.assistant]),
  () => {
    // 旧DOM がまだ残っている段階で画面内要素をキャプチャ
    captureVisibleUuids()

    // 新DOM に切り替わった後にスクロール
    nextTick(() => {
      const target = findScrollTarget()
      if (target) {
        const el = document.querySelector(`[data-uuid="${target}"]`)
        if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'start' })
        }
      }
    })
  }
)

// 表示用アイテムリスト
const displayItems = computed<ConvItem[]>(() => {
  const entries = filteredConversations.value
  const searchText = state.searchText.toLowerCase()

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
  <div ref="containerRef" class="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
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
        <div
          :data-uuid="getItemUuid(item)"
          @click="setAnchor(getItemUuid(item))"
          :class="state.anchorUuid === getItemUuid(item) ? 'ring-1 ring-accent rounded-lg' : ''"
        >
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
            :default-expanded="state.filters.subagents === 'expanded'"
          />
        </div>
      </template>
    </template>
  </div>
</template>
