<script setup lang="ts">
import { useConversations } from '../composables/useConversations'
import type { SubagentMode } from '../composables/useConversations'

const { state, setSinceFilter } = useConversations()

function onSinceChange(e: Event) {
  setSinceFilter((e.target as HTMLSelectElement).value)
}

function toggleFilter(key: keyof typeof state.filters) {
  if (key === 'subagents') return // handled by cycleSubagentMode
  state.filters[key] = !state.filters[key] as any
}

const subagentModes: { mode: SubagentMode; icon: string; label: string }[] = [
  { mode: 'hidden', icon: '🧩', label: '非表示' },
  { mode: 'collapsed', icon: '🧩', label: '折りたたみ' },
  { mode: 'expanded', icon: '🧩', label: '展開' },
]

function cycleSubagentMode() {
  const order: SubagentMode[] = ['hidden', 'collapsed', 'expanded']
  const idx = order.indexOf(state.filters.subagents)
  state.filters.subagents = order[(idx + 1) % 3]
}

function subagentButtonLabel(): string {
  const m = subagentModes.find(s => s.mode === state.filters.subagents)
  return m ? `${m.icon} ${m.label}` : '🧩'
}

const boolButtons: Array<{ key: Exclude<keyof typeof state.filters, 'subagents'>; icon: string; label: string }> = [
  { key: 'user', icon: '👤', label: 'User' },
  { key: 'assistant', icon: '🤖', label: 'Assistant' },
  { key: 'tools', icon: '🔧', label: 'Tools' },
  { key: 'thinking', icon: '💭', label: 'Thinking' },
  { key: 'hooks', icon: '📡', label: 'Hooks' },
]
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-2 bg-surface border-b border-[#222] flex-shrink-0 flex-wrap">
    <div class="flex items-center gap-1.5">
      <label class="text-text-dim text-xs whitespace-nowrap">期間</label>
      <select :value="state.sinceFilter" @change="onSinceChange">
        <option value="today">今日</option>
        <option value="3days">3日</option>
        <option value="week">1週間</option>
        <option value="all">全期間</option>
      </select>
    </div>
    <div class="flex items-center gap-1.5 flex-wrap">
      <label class="text-text-dim text-xs whitespace-nowrap">表示</label>
      <div class="flex gap-1.5 flex-wrap">
        <button
          v-for="btn in boolButtons"
          :key="btn.key"
          @click="toggleFilter(btn.key)"
          class="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer border-none"
          :class="state.filters[btn.key]
            ? 'bg-accent text-white'
            : 'bg-surface2 text-text-dim'"
        >
          {{ btn.icon }} {{ btn.label }}
        </button>
        <button
          @click="cycleSubagentMode"
          class="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer border-none"
          :class="state.filters.subagents === 'hidden'
            ? 'bg-surface2 text-text-dim'
            : state.filters.subagents === 'expanded'
              ? 'bg-accent text-white'
              : 'bg-[#8b4560] text-white'"
        >
          {{ subagentButtonLabel() }}
        </button>
      </div>
    </div>
    <div class="flex items-center gap-1.5 flex-1">
      <input
        v-model="state.searchText"
        type="text"
        placeholder="テキスト検索..."
        class="w-full max-w-75"
      />
    </div>
  </div>
</template>
