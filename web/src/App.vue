<script setup lang="ts">
import { onMounted } from 'vue'
import ProjectTree from './components/ProjectTree.vue'
import FilterBar from './components/FilterBar.vue'
import ConversationView from './components/ConversationView.vue'
import { useConversations } from './composables/useConversations'

const { state, fetchProjects, restoreFromUrl } = useConversations()

onMounted(async () => {
  const hash = window.location.hash
  if (hash && hash !== '#') {
    await restoreFromUrl()
  } else {
    await fetchProjects()
  }
})
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- 左サイドバー -->
    <aside class="w-62.5 flex-shrink-0 bg-surface border-r border-[#222] flex flex-col overflow-hidden">
      <div class="flex items-center gap-2 px-4 py-3 border-b border-[#222] bg-surface2">
        <span class="font-bold text-base text-accent tracking-wide">ccconv</span>
        <span v-if="state.loading" class="text-[8px] text-accent" style="animation: pulse 1s infinite">●</span>
      </div>
      <ProjectTree />
    </aside>
    <!-- メインエリア -->
    <main class="flex-1 flex flex-col overflow-hidden bg-bg">
      <FilterBar />
      <ConversationView />
    </main>
  </div>
</template>
