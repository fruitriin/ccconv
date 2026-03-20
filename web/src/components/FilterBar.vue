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
  <div class="filter-bar">
    <div class="filter-group">
      <label>期間</label>
      <select :value="state.sinceFilter" @change="onSinceChange">
        <option value="today">今日</option>
        <option value="3days">3日</option>
        <option value="week">1週間</option>
        <option value="all">全期間</option>
      </select>
    </div>
    <div class="filter-group">
      <label>種別</label>
      <select :value="state.typeFilter" @change="onTypeChange">
        <option value="all">すべて</option>
        <option value="user">ユーザー</option>
        <option value="assistant">アシスタント</option>
      </select>
    </div>
    <div class="filter-group search-group">
      <input
        v-model="state.searchText"
        type="text"
        placeholder="テキスト検索..."
        class="search-input"
      />
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--surface);
  border-bottom: 1px solid #222;
  flex-shrink: 0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

label {
  color: var(--text-dim);
  font-size: 12px;
  white-space: nowrap;
}

.search-group {
  flex: 1;
}

.search-input {
  width: 100%;
  max-width: 300px;
}
</style>
