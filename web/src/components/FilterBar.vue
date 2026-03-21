<script setup lang="ts">
import { useConversations } from '../composables/useConversations'
import type { TriState, Filters } from '../composables/useConversations'

const { state, setSinceFilter } = useConversations()

function onSinceChange(e: Event) {
  setSinceFilter((e.target as HTMLSelectElement).value)
}

function toggleBool(key: 'user' | 'assistant' | 'hooks') {
  state.filters[key] = !state.filters[key]
}

function cycleTriState(key: 'tools' | 'thinking' | 'subagents') {
  const order: TriState[] = ['hidden', 'collapsed', 'expanded']
  const idx = order.indexOf(state.filters[key])
  state.filters[key] = order[(idx + 1) % 3]
}

function triStateClass(val: TriState): string {
  if (val === 'hidden') return 'bg-surface2 text-text-dim'
  if (val === 'collapsed') return 'bg-[#8b4560] text-white'
  return 'bg-accent text-white'
}

function triStateLabel(icon: string, name: string, val: TriState): string {
  const suffix = val === 'hidden' ? '非表示' : val === 'collapsed' ? '折りたたみ' : '展開'
  return `${icon} ${name}: ${suffix}`
}

const boolButtons: Array<{ key: 'user' | 'assistant' | 'hooks'; icon: string; label: string }> = [
  { key: 'user', icon: '👤', label: 'User' },
  { key: 'assistant', icon: '🤖', label: 'Assistant' },
  { key: 'hooks', icon: '📡', label: 'Hooks' },
]

const triButtons: Array<{ key: 'tools' | 'thinking' | 'subagents'; icon: string; label: string }> = [
  { key: 'tools', icon: '🔧', label: 'Tools' },
  { key: 'thinking', icon: '💭', label: 'Thinking' },
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
        <!-- Boolean トグル -->
        <button
          v-for="btn in boolButtons"
          :key="btn.key"
          @click="toggleBool(btn.key)"
          class="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer border-none"
          :class="state.filters[btn.key]
            ? 'bg-accent text-white'
            : 'bg-surface2 text-text-dim'"
        >
          {{ btn.icon }} {{ btn.label }}
        </button>
        <!-- 3状態トグル -->
        <button
          v-for="btn in triButtons"
          :key="btn.key"
          @click="cycleTriState(btn.key)"
          class="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer border-none"
          :class="triStateClass(state.filters[btn.key])"
          :title="triStateLabel(btn.icon, btn.label, state.filters[btn.key])"
        >
          {{ btn.icon }} {{ btn.label }}
        </button>
      </div>
    </div>
    <div class="flex items-center gap-1.5">
      <label class="text-text-dim text-xs whitespace-nowrap">表示モード</label>
      <div class="flex gap-1">
        <button
          @click="state.viewMode = 'linear'"
          class="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer border-none"
          :class="state.viewMode === 'linear' ? 'bg-accent text-white' : 'bg-surface2 text-text-dim'"
          title="リニア表示"
        >
          📋 リニア
        </button>
        <button
          @click="state.viewMode = 'pane'"
          class="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer border-none"
          :class="state.viewMode === 'pane' ? 'bg-accent text-white' : 'bg-surface2 text-text-dim'"
          title="ペイン分割（個別スクロール）"
        >
          🪟 ペイン
        </button>
        <button
          @click="state.viewMode = 'pane-flow'"
          class="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer border-none"
          :class="state.viewMode === 'pane-flow' ? 'bg-accent text-white' : 'bg-surface2 text-text-dim'"
          title="ペイン分割（ページスクロール）"
        >
          📜 フロー
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
