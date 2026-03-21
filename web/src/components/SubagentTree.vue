<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Entry } from '../composables/useConversations'
import Tooltip from './Tooltip.vue'
import {
  getTextContent,
  isToolUse,
  isEmptySubagentEntry,
  getToolNames,
  formatTime,
} from '../composables/useMessageUtils'

const props = withDefaults(defineProps<{
  entries: Entry[]
  agentId: string
  defaultExpanded?: boolean
  anchorUuid?: string | null
}>(), {
  defaultExpanded: false,
  anchorUuid: null,
})

const emit = defineEmits<{
  setAnchor: [uuid: string]
}>()

const manualToggle = ref<boolean | null>(null)
const expanded = computed(() => manualToggle.value !== null ? manualToggle.value : props.defaultExpanded)

function toggleExpand() {
  manualToggle.value = !expanded.value
}

function getModel(): string {
  const assistantEntry = props.entries.find(e => e.type === 'assistant' && e.message?.model)
  return assistantEntry?.message?.model?.split('-').slice(0, 2).join('-') ?? 'unknown'
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
        v-if="!isEmptySubagentEntry(entry)"
        :data-uuid="entry.uuid"
        @click="entry.uuid && emit('setAnchor', entry.uuid)"
        class="rounded-md p-2 text-[13px]"
        :class="[
          anchorUuid === entry.uuid ? 'ring-1 ring-accent' : '',
          entry.type === 'user' ? 'bg-[rgba(26,58,92,0.6)] self-end max-w-[85%]' : 'bg-[rgba(42,42,62,0.8)] self-start max-w-[85%]'
        ]"
      >
        <div class="flex items-center gap-2 mb-1 text-[11px]">
          <span class="font-semibold text-text-dim">{{ entry.type === 'user' ? 'User' : 'Assistant' }}</span>
          <span class="text-text-dim">{{ formatTime(entry.timestamp) }}</span>
          <Tooltip v-if="isToolUse(entry)" :text="getToolNames(entry).join(', ')">
            <span class="text-[#f0a500] text-[11px] truncate max-w-[60%] inline-block">
              🔧 {{ getToolNames(entry).join(', ') }}
            </span>
          </Tooltip>
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
