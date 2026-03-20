<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConversations } from '../composables/useConversations'

const { state, fetchProjects, selectProject, selectSession } = useConversations()

// 展開中のプロジェクトセット
const expandedProjects = ref<Set<string>>(new Set())

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
  <div class="project-tree">
    <div class="section-header">プロジェクト</div>
    <div v-if="state.loading && state.projects.length === 0" class="loading">読込中...</div>
    <div v-else-if="state.projects.length === 0" class="empty">プロジェクトなし</div>

    <template v-for="project in state.projects" :key="project.name">
      <!-- プロジェクト行 -->
      <div
        class="project-item"
        :class="{ selected: state.selectedProject === project.name }"
        @click="handleProjectClick(project.name)"
      >
        <span class="toggle-icon">{{ expandedProjects.has(project.name) ? '▼' : '▶' }}</span>
        <span class="project-name" :title="project.name">{{ shortName(project.name) }}</span>
        <span class="project-badges">
          <span class="badge">💬{{ project.totalMessages }}</span>
          <span v-if="project.subagentCount > 0" class="badge">🤖{{ project.subagentCount }}</span>
        </span>
      </div>

      <!-- セッション一覧（展開時） -->
      <template v-if="expandedProjects.has(project.name) && state.selectedProject === project.name">
        <div v-if="state.loading && state.sessions.length === 0" class="session-loading">
          読込中...
        </div>
        <div v-else-if="state.sessions.length === 0" class="session-empty">
          セッションなし
        </div>
        <div
          v-for="session in state.sessions"
          :key="getSessionId(session)"
          class="session-item"
          :class="{ selected: state.selectedSession === getSessionId(session) }"
          @click.stop="handleSessionClick(project.name, getSessionId(session))"
        >
          <span class="session-date">{{ formatDate(getLastUpdate(session)) }}</span>
          <span class="session-id">{{ shortSessionId(getSessionId(session)) }}</span>
          <span class="session-badges">
            <span class="badge">💬{{ getMsgCount(session) }}</span>
            <span v-if="getSubagentCount(session) > 0" class="badge">🤖{{ getSubagentCount(session) }}</span>
          </span>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.project-tree {
  overflow-y: auto;
  flex: 1;
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

/* プロジェクト行 */
.project-item {
  display: flex;
  align-items: center;
  gap: 6px;
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

.toggle-icon {
  font-size: 9px;
  color: var(--text-dim);
  flex-shrink: 0;
  width: 12px;
}

.project-name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
  flex: 1;
  min-width: 0;
}

.project-badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* セッション行 */
.session-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 28px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  transition: background 0.15s;
  background: rgba(0,0,0,0.1);
}

.session-item:hover {
  background: var(--surface2);
}

.session-item.selected {
  background: var(--surface2);
  border-left: 2px solid var(--accent);
  padding-left: 26px;
}

.session-date {
  font-size: 11px;
  color: var(--text-dim);
  flex-shrink: 0;
  white-space: nowrap;
}

.session-id {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-dim);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.session-loading, .session-empty {
  padding: 6px 12px 6px 28px;
  font-size: 11px;
  color: var(--text-dim);
  background: rgba(0,0,0,0.1);
}

.badge {
  font-size: 10px;
  color: var(--text-dim);
}
</style>
