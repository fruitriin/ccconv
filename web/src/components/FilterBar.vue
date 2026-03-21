<script setup lang="ts">
import { useConversations } from '../composables/useConversations'

const { state, setSinceFilter } = useConversations()

function onSinceChange(e: Event) {
  setSinceFilter((e.target as HTMLSelectElement).value)
}

function toggleFilter(key: keyof typeof state.filters) {
  state.filters[key] = !state.filters[key]
}

const buttons: Array<{ key: keyof typeof state.filters; icon: string; label: string }> = [
  { key: 'user', icon: '👤', label: 'User' },
  { key: 'assistant', icon: '🤖', label: 'Assistant' },
  { key: 'tools', icon: '🔧', label: 'Tools' },
  { key: 'thinking', icon: '💭', label: 'Thinking' },
  { key: 'hooks', icon: '📡', label: 'Hooks' },
  { key: 'subagents', icon: '🧩', label: 'Subagents' },
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
          v-for="btn in buttons"
          :key="btn.key"
          @click="toggleFilter(btn.key)"
          class="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer border-none"
          :class="state.filters[btn.key]
            ? 'bg-accent text-white'
            : 'bg-surface2 text-text-dim'"
        >
          {{ btn.icon }} {{ btn.label }}
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
