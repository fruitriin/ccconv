<script setup lang="ts">
import { onMounted } from 'vue'
import { useConversations } from '../composables/useConversations'

const { state, fetchProjects, selectProject } = useConversations()

onMounted(() => {
  fetchProjects()
})

function shortName(name: string): string {
  // -Users-riin-workspace- 以降を取り出す
  const parts = name.split('-')
  if (parts.length > 4) {
    return parts.slice(4).join('-') || name
  }
  return name
}
</script>

<template>
  <div class="overflow-y-auto flex-shrink-0">
    <div class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim border-b border-[#222]">
      プロジェクト
    </div>
    <div v-if="state.loading && state.projects.length === 0" class="px-3 py-3 text-text-dim text-xs">読込中...</div>
    <div v-else-if="state.projects.length === 0" class="px-3 py-3 text-text-dim text-xs">プロジェクトなし</div>
    <div
      v-for="project in state.projects"
      :key="project.name"
      class="px-3 py-2 cursor-pointer border-b border-white/4 transition-colors hover:bg-surface2"
      :class="{ 'bg-surface2 border-l-2 border-l-accent': state.selectedProject === project.name }"
      @click="selectProject(project.name)"
    >
      <div class="text-xs whitespace-nowrap overflow-hidden text-ellipsis text-text" :title="project.name">{{ shortName(project.name) }}</div>
      <div class="flex gap-1.5 mt-0.75">
        <span v-if="project.subagentCount > 0" class="text-[11px] text-text-dim">🤖{{ project.subagentCount }}</span>
        <span class="text-[11px] text-text-dim">💬{{ project.totalMessages }}</span>
      </div>
    </div>
  </div>
</template>
