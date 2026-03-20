<script setup lang="ts">
import ProjectList from './components/ProjectList.vue'
import SessionList from './components/SessionList.vue'
import FilterBar from './components/FilterBar.vue'
import ConversationView from './components/ConversationView.vue'
import { useConversations } from './composables/useConversations'

const { state } = useConversations()
</script>

<template>
  <div class="app-layout">
    <!-- 左サイドバー -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="app-title">ccconv</span>
        <span v-if="state.loading" class="loading-dot">●</span>
      </div>
      <ProjectList />
      <SessionList />
    </aside>
    <!-- メインエリア -->
    <main class="main">
      <FilterBar />
      <ConversationView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 250px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid #222;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #222;
  background: var(--surface2);
}

.app-title {
  font-weight: 700;
  font-size: 16px;
  color: var(--accent);
  letter-spacing: 0.05em;
}

.loading-dot {
  font-size: 8px;
  color: var(--accent);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}
</style>
