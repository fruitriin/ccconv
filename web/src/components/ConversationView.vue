<script setup lang="ts">
import { computed, watch, nextTick, ref } from 'vue'
import { useConversations } from '../composables/useConversations'
import type { Entry } from '../composables/useConversations'
import { getTextContent } from '../composables/useMessageUtils'
import SubagentTree from './SubagentTree.vue'
import MessageBubble from './MessageBubble.vue'
import PaneLayout from './PaneLayout.vue'

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

// フィルタ変更時のスクロール保持
// 意図的に flush: "pre"（デフォルト）を使用:
//   1. watch コールバック時点では旧 DOM が残っている → captureVisibleUuids() で画面内要素を記憶
//   2. nextTick() で新 DOM に切り替わった後 → findScrollTarget() でアンカー先を探してスクロール
// flush: "post" にすると旧 DOM のキャプチャができないため、この watch は flush: "pre" が正しい
// 参照: docs/knowhow/vue-watch-vs-computed.md
watch(
  () => [state.filters.tools, state.filters.thinking, state.filters.subagents, state.filters.hooks, state.filters.user, state.filters.assistant] as const,
  () => {
    captureVisibleUuids() // 旧 DOM（flush: "pre" なのでまだ更新前）

    nextTick(() => {      // 新 DOM（nextTick で更新後）
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
  <!-- 状態表示（セッション未選択 / 空） -->
  <div v-if="!state.selectedSession && !state.loading" class="flex-1 flex items-center justify-center">
    <div class="text-text-dim text-center text-sm opacity-50">
      プロジェクトを選択してください
    </div>
  </div>
  <div v-else-if="displayItems.length === 0" class="flex-1 flex items-center justify-center">
    <div class="text-text-dim text-center text-sm">
      表示するメッセージがありません
    </div>
  </div>

  <!-- ペインモード -->
  <PaneLayout
    v-else-if="state.viewMode === 'pane' || state.viewMode === 'pane-flow'"
    :display-items="displayItems"
    :search-text="state.searchText"
    :anchor-uuid="state.anchorUuid"
    :flow-mode="state.viewMode === 'pane-flow'"
    :sync-timeline="state.syncTimeline"
    @set-anchor="setAnchor"
  />

  <!-- リニアモード（既存） -->
  <div v-else ref="containerRef" class="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
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
          :anchor-uuid="state.anchorUuid"
          @set-anchor="setAnchor"
        />
      </div>
    </template>
  </div>
</template>
