<script setup lang="ts">
import { ref } from 'vue'
import type { Entry } from '../composables/useConversations'

const props = defineProps<{
  entries: Entry[]
  agentId: string
}>()

const expanded = ref(false)

function toggleExpand() {
  expanded.value = !expanded.value
}

function getModel(): string {
  const assistantEntry = props.entries.find(e => e.type === 'assistant' && e.message?.model)
  return assistantEntry?.message?.model?.split('-').slice(0, 2).join('-') ?? 'unknown'
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function getTextContent(entry: Entry): string {
  const content = entry.message?.content
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text ?? '')
      .join('\n')
  }
  return ''
}

function isToolUse(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  return content.some(c => c.type === 'tool_use')
}

function getToolNames(entry: Entry): string[] {
  const content = entry.message?.content
  if (!Array.isArray(content)) return []
  return content.filter(c => c.type === 'tool_use').map(c => c.name ?? '(tool)')
}
</script>

<template>
  <div class="subagent-tree">
    <div class="subagent-header" @click="toggleExpand">
      <span class="toggle">{{ expanded ? '▼' : '▶' }}</span>
      <span class="label">🤖 {{ agentId.slice(0, 8) }} ({{ getModel() }})</span>
      <span class="msg-count">{{ entries.length }}件</span>
    </div>
    <div v-if="expanded" class="subagent-body">
      <div
        v-for="entry in entries"
        :key="entry.uuid ?? entry.timestamp"
        class="entry"
        :class="entry.type"
      >
        <div class="entry-meta">
          <span class="entry-role">{{ entry.type === 'user' ? 'User' : 'Assistant' }}</span>
          <span class="entry-time">{{ formatTime(entry.timestamp) }}</span>
          <span v-if="isToolUse(entry)" class="tool-badge">
            🔧 {{ getToolNames(entry).join(', ') }}
          </span>
        </div>
        <div class="entry-content" v-if="getTextContent(entry)">
          {{ getTextContent(entry) }}
        </div>
        <div class="entry-content empty-content" v-else-if="isToolUse(entry)">
          ツール実行
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subagent-tree {
  margin: 8px 0;
  border: 1px solid var(--subagent-border);
  border-radius: 6px;
  overflow: hidden;
}

.subagent-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(233, 69, 96, 0.1);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.subagent-header:hover {
  background: rgba(233, 69, 96, 0.2);
}

.toggle {
  font-size: 10px;
  color: var(--accent);
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  flex: 1;
}

.msg-count {
  font-size: 11px;
  color: var(--text-dim);
}

.subagent-body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(0,0,0,0.2);
}

.entry {
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
}

.entry.user {
  background: rgba(26, 58, 92, 0.6);
  align-self: flex-end;
  max-width: 85%;
}

.entry.assistant {
  background: rgba(42, 42, 62, 0.8);
  align-self: flex-start;
  max-width: 85%;
}

.entry-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 11px;
}

.entry-role {
  font-weight: 600;
  color: var(--text-dim);
}

.entry-time {
  color: var(--text-dim);
}

.tool-badge {
  color: #f0a500;
  font-size: 11px;
}

.entry-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  color: var(--text);
}

.empty-content {
  color: var(--text-dim);
  font-style: italic;
  font-size: 12px;
}
</style>
