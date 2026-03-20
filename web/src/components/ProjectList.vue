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
  <div class="project-list">
    <div class="section-header">プロジェクト</div>
    <div v-if="state.loading && state.projects.length === 0" class="loading">読込中...</div>
    <div v-else-if="state.projects.length === 0" class="empty">プロジェクトなし</div>
    <div
      v-for="project in state.projects"
      :key="project.name"
      class="project-item"
      :class="{ selected: state.selectedProject === project.name }"
      @click="selectProject(project.name)"
    >
      <div class="project-name" :title="project.name">{{ shortName(project.name) }}</div>
      <div class="project-meta">
        <span v-if="project.subagentCount > 0" class="badge">🤖{{ project.subagentCount }}</span>
        <span class="badge">💬{{ project.totalMessages }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.project-list {
  overflow-y: auto;
  flex-shrink: 0;
}

.section-header {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  border-bottom: 1px solid #222;
}

.loading, .empty {
  padding: 12px;
  color: var(--text-dim);
  font-size: 12px;
}

.project-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.15s;
}

.project-item:hover {
  background: var(--surface2);
}

.project-item.selected {
  background: var(--surface2);
  border-left: 2px solid var(--accent);
}

.project-name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}

.project-meta {
  display: flex;
  gap: 6px;
  margin-top: 3px;
}

.badge {
  font-size: 11px;
  color: var(--text-dim);
}
</style>
