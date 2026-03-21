<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Entry } from '../composables/useConversations'
import {
  getTextContent,
  isToolUse,
  getToolNames,
  formatTime,
} from '../composables/useMessageUtils'

const props = withDefaults(defineProps<{
  entries: Entry[]
  agentId: string
  defaultExpanded?: boolean
}>(), {
  defaultExpanded: false,
})

const expanded = ref(props.defaultExpanded)

watch(() => props.defaultExpanded, (val) => {
  expanded.value = val
})

function toggleExpand() {
  expanded.value = !expanded.value
}

function getModel(): string {
  const assistantEntry = props.entries.find(e => e.type === 'assistant' && e.message?.model)
  return assistantEntry?.message?.model?.split('-').slice(0, 2).join('-') ?? 'unknown'
}

function isToolResult(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  return content.some(c => c.type === 'tool_result')
}

function isEmptyEntry(entry: Entry): boolean {
  const text = getTextContent(entry)
  if (text.trim()) return false
  if (isToolUse(entry)) return false
  // tool_result はテキストがなくても空ではない（Tools フィルタで制御すべき）
  // ただしサブエージェント内では表示しても中身が見えないので空扱い
  if (isToolResult(entry) && !text.trim()) return true
  const content = entry.message?.content
  if (!content) return true
  if (typeof content === 'string' && !content.trim()) return true
  if (Array.isArray(content) && content.length === 0) return true
  if (Array.isArray(content) && content.every(c =>
    (c.type === 'text' && !c.text?.trim()) ||
    (c.type === 'tool_result')
  )) return true
  return false
}
</script>

<template>
  <div class="my-2 border border-subagent-border rounded-md">
    <!-- ヘッダー -->
    <div
      class="flex items-center gap-2 px-2.5 py-1.5 bg-[rgba(233,69,96,0.1)] cursor-pointer select-none transition-colors hover:bg-[rgba(233,69,96,0.2)]"
      @click="toggleExpand"
    >
      <span class="text-[10px] text-accent">{{ expanded ? '▼' : '▶' }}</span>
      <span class="text-xs font-semibold text-accent flex-1">🤖 {{ agentId.slice(0, 8) }} ({{ getModel() }})</span>
      <span class="text-[11px] text-text-dim">{{ entries.length }}件</span>
    </div>
    <!-- ボディ -->
    <div v-if="expanded" class="p-2 flex flex-col gap-1.5 bg-black/20 max-h-[60vh] overflow-y-auto">
      <template
        v-for="entry in entries"
        :key="entry.uuid ?? entry.timestamp"
      >
      <div
        v-if="!isEmptyEntry(entry)"
        class="rounded-md p-2 text-[13px]"
        :class="entry.type === 'user'
          ? 'bg-[rgba(26,58,92,0.6)] self-end max-w-[85%]'
          : 'bg-[rgba(42,42,62,0.8)] self-start max-w-[85%]'"
      >
        <div class="flex items-center gap-2 mb-1 text-[11px]">
          <span class="font-semibold text-text-dim">{{ entry.type === 'user' ? 'User' : 'Assistant' }}</span>
          <span class="text-text-dim">{{ formatTime(entry.timestamp) }}</span>
          <span v-if="isToolUse(entry)" class="text-[#f0a500] text-[11px] truncate max-w-[60%]" :title="getToolNames(entry).join(', ')">
            🔧 {{ getToolNames(entry).join(', ') }}
          </span>
        </div>
        <div v-if="getTextContent(entry)" class="whitespace-pre-wrap break-words leading-relaxed text-text">
          {{ getTextContent(entry) }}
        </div>
        <div v-else-if="isToolUse(entry)" class="text-text-dim italic text-xs">
          ツール実行
        </div>
      </div>
      </template>
    </div>
  </div>
</template>
