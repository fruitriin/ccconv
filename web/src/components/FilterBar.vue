<script setup lang="ts">
import { useConversations } from '../composables/useConversations'

const { state, setSinceFilter } = useConversations()

function onSinceChange(e: Event) {
  setSinceFilter((e.target as HTMLSelectElement).value)
}

function onTypeChange(e: Event) {
  state.typeFilter = (e.target as HTMLSelectElement).value
}
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-2 bg-surface border-b border-[#222] flex-shrink-0">
    <div class="flex items-center gap-1.5">
      <label class="text-text-dim text-xs whitespace-nowrap">期間</label>
      <select :value="state.sinceFilter" @change="onSinceChange">
        <option value="today">今日</option>
        <option value="3days">3日</option>
        <option value="week">1週間</option>
        <option value="all">全期間</option>
      </select>
    </div>
    <div class="flex items-center gap-1.5">
      <label class="text-text-dim text-xs whitespace-nowrap">種別</label>
      <select :value="state.typeFilter" @change="onTypeChange">
        <option value="all">すべて</option>
        <option value="user">ユーザー</option>
        <option value="assistant">アシスタント</option>
      </select>
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
