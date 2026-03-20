<script setup lang="ts">
import { watch } from 'vue'
import { useConversations } from '../composables/useConversations'
import type { Session } from '../composables/useConversations'

const { state, selectSession } = useConversations()

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

// SessionInfo から messageCount / subagentCount を取得するため型ガード
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
  <div class="session-list">
    <div class="section-header">セッション</div>
    <div v-if="!state.selectedProject" class="empty">プロジェクトを選択</div>
    <div v-else-if="state.loading && state.sessions.length === 0" class="loading">読込中...</div>
    <div v-else-if="state.sessions.length === 0" class="empty">セッションなし</div>
    <div
      v-for="session in state.sessions"
      :key="getSessionId(session)"
      class="session-item"
      :class="{ selected: state.selectedSession === getSessionId(session) }"
      @click="selectSession(getSessionId(session))"
    >
      <div class="session-id">{{ shortSessionId(getSessionId(session)) }}</div>
      <div class="session-date">{{ formatDate(getLastUpdate(session)) }}</div>
      <div class="session-meta">
        <span class="badge">💬{{ getMsgCount(session) }}</span>
        <span v-if="getSubagentCount(session) > 0" class="badge">🤖{{ getSubagentCount(session) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-list {
  overflow-y: auto;
  flex: 1;
  border-top: 1px solid #222;
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

.session-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.15s;
}

.session-item:hover {
  background: var(--surface2);
}

.session-item.selected {
  background: var(--surface2);
  border-left: 2px solid var(--accent);
}

.session-id {
  font-size: 12px;
  font-family: monospace;
  color: var(--text);
}

.session-date {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
}

.session-meta {
  display: flex;
  gap: 6px;
  margin-top: 3px;
}

.badge {
  font-size: 11px;
  color: var(--text-dim);
}
</style>
