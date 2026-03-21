<script setup lang="ts">
import { ref, watch } from 'vue'
import { useConversations } from '../composables/useConversations'

const { state, selectProject, selectSession } = useConversations()

// 展開中のプロジェクトセット
const expandedProjects = ref<Set<string>>(new Set())

// 選択中のプロジェクトを自動展開
watch(() => state.selectedProject, (project) => {
  if (project) expandedProjects.value.add(project)
})

function shortName(name: string): string {
  // -Users-riin-workspace- 以降を取り出す
  const parts = name.split('-')
  if (parts.length > 4) {
    return parts.slice(4).join('-') || name
  }
  return name
}

function toggleProject(name: string) {
  if (expandedProjects.value.has(name)) {
    expandedProjects.value.delete(name)
  } else {
    expandedProjects.value.add(name)
    // 展開時にセッション一覧を取得（まだ選択されていない or 別プロジェクト）
    if (state.selectedProject !== name) {
      selectProject(name)
    }
  }
}

function handleProjectClick(name: string) {
  // プロジェクト名クリックで展開/折りたたみ + セッション取得
  const wasExpanded = expandedProjects.value.has(name)
  if (wasExpanded) {
    expandedProjects.value.delete(name)
  } else {
    expandedProjects.value.add(name)
    selectProject(name)
  }
}

function handleSessionClick(projectName: string, sessionId: string) {
  // プロジェクトが違う場合はまず切り替え
  if (state.selectedProject !== projectName) {
    selectProject(projectName)
    expandedProjects.value.add(projectName)
  }
  selectSession(sessionId)
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortSessionId(id: string): string {
  return id.slice(0, 8)
}

function getSessionId(s: any): string {
  return s.sessionId || ''
}
function getMsgCount(s: any): number {
  return s.messageCount ?? s.totalMessages ?? 0
}
function getSubagentCount(s: any): number {
  return s.subagentCount ?? 0
}
function getLastUpdate(s: any): string {
  return s.lastTimestamp ?? s.lastUpdate ?? ''
}
</script>

<template>
  <div class="overflow-y-auto flex-1">
    <!-- セクションヘッダー -->
    <div class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim border-b border-[#222]">
      プロジェクト
    </div>
    <div v-if="state.loading && state.projects.length === 0" class="px-3 py-3 text-text-dim text-xs">読込中...</div>
    <div v-else-if="state.projects.length === 0" class="px-3 py-3 text-text-dim text-xs">プロジェクトなし</div>

    <template v-for="project in state.projects" :key="project.name">
      <!-- プロジェクト行 -->
      <div
        class="flex items-center gap-1.5 px-3 py-2 cursor-pointer border-b border-white/4 transition-colors hover:bg-surface2"
        :class="{ 'bg-surface2 border-l-2 border-l-accent': state.selectedProject === project.name }"
        @click="handleProjectClick(project.name)"
      >
        <span class="text-[9px] text-text-dim flex-shrink-0 w-3">{{ expandedProjects.has(project.name) ? '▼' : '▶' }}</span>
        <span class="text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis text-text flex-1 min-w-0" :title="project.name">{{ shortName(project.name) }}</span>
        <span class="flex gap-1 flex-shrink-0">
          <span class="text-[10px] text-text-dim">💬{{ project.totalMessages }}</span>
          <span v-if="project.subagentCount > 0" class="text-[10px] text-text-dim">🤖{{ project.subagentCount }}</span>
        </span>
      </div>

      <!-- セッション一覧（展開時） -->
      <template v-if="expandedProjects.has(project.name) && state.selectedProject === project.name">
        <div v-if="state.loading && state.sessions.length === 0" class="px-3 py-1.5 pl-7 text-[11px] text-text-dim bg-black/10">
          読込中...
        </div>
        <div v-else-if="state.sessions.length === 0" class="px-3 py-1.5 pl-7 text-[11px] text-text-dim bg-black/10">
          セッションなし
        </div>
        <div
          v-for="session in state.sessions"
          :key="getSessionId(session)"
          class="flex items-center gap-1.5 px-3 py-1.5 pl-7 cursor-pointer border-b border-white/3 bg-black/10 transition-colors hover:bg-surface2"
          :class="{ 'bg-surface2 border-l-2 border-l-accent !pl-6.5': state.selectedSession === getSessionId(session) }"
          @click.stop="handleSessionClick(project.name, getSessionId(session))"
        >
          <span class="text-[11px] text-text-dim flex-shrink-0 whitespace-nowrap">{{ formatDate(getLastUpdate(session)) }}</span>
          <span class="text-[11px] font-mono text-text-dim flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">{{ shortSessionId(getSessionId(session)) }}</span>
          <span class="flex gap-1 flex-shrink-0">
            <span class="text-[10px] text-text-dim">💬{{ getMsgCount(session) }}</span>
            <span v-if="getSubagentCount(session) > 0" class="text-[10px] text-text-dim">🤖{{ getSubagentCount(session) }}</span>
          </span>
        </div>
      </template>
    </template>
  </div>
</template>
