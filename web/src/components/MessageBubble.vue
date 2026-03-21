<script setup lang="ts">
import { ref } from 'vue'
import { useConversations } from '../composables/useConversations'
import type { Entry } from '../composables/useConversations'
import {
  getTextContent,
  isToolUse,
  hasOnlyToolUse,
  getToolUseItems,
  getToolSummary,
  getToolResultContent,
  getThinkingItems,
  hasThinkingOnly,
  isEmptyEntry,
  isSkillPrompt,
  getSkillName,
  formatTime,
  highlightText,
  getHookPreview,
} from '../composables/useMessageUtils'

const props = defineProps<{
  entry: Entry
  searchText: string
  idx: number
}>()

const { state, isHook, isToolResultEntry } = useConversations()

// 折りたたみ状態（このバブル内でのみ管理）
// filters の TriState が 'expanded' なら初期展開
const expandedThinking = ref(false)
const expandedSkill = ref(false)
const expandedToolResults = ref<Set<number>>(new Set())

// filters の状態に応じて初期展開するかを判定
function isToolResultExpanded(tri: number): boolean {
  if (state.filters.tools === 'expanded') return true
  return expandedToolResults.value.has(tri)
}

function isThinkingExpanded(): boolean {
  if (state.filters.thinking === 'expanded') return true
  return expandedThinking.value
}

function toggleThinking() {
  expandedThinking.value = !expandedThinking.value
}

function toggleSkill() {
  expandedSkill.value = !expandedSkill.value
}

function toggleToolResult(tri: number) {
  if (expandedToolResults.value.has(tri)) {
    expandedToolResults.value.delete(tri)
  } else {
    expandedToolResults.value.add(tri)
  }
}

function isEmpty(): boolean {
  return isEmptyEntry(props.entry, { isHook, isToolResultEntry })
}
</script>

<template>
  <!-- Hook エントリ -->
  <div
    v-if="isHook(entry)"
    class="rounded-lg px-3 py-1.5 text-text-dim text-xs self-start bg-surface2 max-w-[80%] border border-[#333]"
  >
    <span class="mr-1">📡</span>
    <span class="font-mono">[system-reminder]</span>
    <span class="ml-1">{{ getHookPreview(entry) }}...</span>
  </div>

  <!-- Tool Result エントリ -->
  <div
    v-else-if="isToolResultEntry(entry)"
    class="rounded-lg px-3 py-1.5 text-xs self-start bg-surface2 max-w-[80%] border border-[#333]"
  >
    <div
      v-for="(tr, tri) in getToolResultContent(entry)"
      :key="tri"
      class="mb-1 last:mb-0"
    >
      <button
        class="flex items-center gap-1.5 text-[11px] cursor-pointer bg-transparent border-none p-0 w-full text-left"
        @click="toggleToolResult(tri)"
      >
        <span class="text-[#f0a500]">🔧</span>
        <span class="text-text-dim font-mono">{{ tr.toolUseId.slice(0, 12) || 'result' }}</span>
        <span class="text-text-dim">{{ formatTime(entry.timestamp) }}</span>
        <span class="text-text-dim">{{ tr.text.length }}文字</span>
        <span class="ml-auto text-text-dim">{{ isToolResultExpanded(tri) ? '▾' : '▸' }}</span>
      </button>
      <div
        v-if="isToolResultExpanded(tri)"
        class="mt-1 whitespace-pre-wrap break-words text-text-dim text-[12px] max-h-[40vh] overflow-y-auto bg-black/30 rounded p-2"
      >{{ tr.text }}</div>
    </div>
  </div>

  <!-- Thinking のみのエントリ -->
  <div
    v-else-if="hasThinkingOnly(entry)"
    class="rounded-lg px-3 py-1.5 text-xs self-start bg-surface2 max-w-[80%] border border-[#333]"
  >
    <button
      class="flex items-center gap-1.5 w-full text-left cursor-pointer bg-transparent border-none p-0"
      @click="toggleThinking"
    >
      <span>💭</span>
      <span class="italic text-text-dim">
        {{ isThinkingExpanded()
          ? '(thinking — クリックで折りたたむ)'
          : (getThinkingItems(entry)[0]?.thinking?.slice(0, 100) ?? '') + '...' }}
      </span>
      <span class="ml-auto text-text-dim">{{ isThinkingExpanded() ? '▾' : '▸' }}</span>
    </button>
    <div v-if="isThinkingExpanded()" class="mt-1.5 italic text-text-dim whitespace-pre-wrap break-words text-[12px]">
      <div v-for="(t, ti) in getThinkingItems(entry)" :key="ti">
        {{ t.thinking }}
      </div>
    </div>
  </div>

  <!-- 通常メッセージ（空エントリは非表示） -->
  <div
    v-else-if="!isEmpty()"
    class="rounded-lg px-3.5 py-2.5 max-w-[80%] text-[13px] leading-relaxed"
    :class="entry.type === 'user'
      ? 'bg-user-bg self-end ml-auto'
      : 'bg-assistant-bg self-start'"
  >
    <div class="flex items-center gap-2 mb-1.5 text-[11px] flex-wrap">
      <span class="font-bold text-text-dim">{{ entry.type === 'user' ? 'User' : 'Assistant' }}</span>
      <span class="text-text-dim">{{ formatTime(entry.timestamp) }}</span>
      <span v-if="entry.message?.usage" class="text-text-dim ml-auto">
        {{ entry.message.usage.input_tokens }}in / {{ entry.message.usage.output_tokens }}out
      </span>
    </div>

    <!-- テキストコンテンツ -->
    <template v-if="getTextContent(entry)">
      <!-- スキルプロンプト（折りたたみ） -->
      <template v-if="isSkillPrompt(entry) && !expandedSkill">
        <div class="flex items-center gap-2">
          <span class="text-accent font-mono text-sm">{{ getSkillName(entry) }}</span>
          <button
            class="text-text-dim text-xs cursor-pointer bg-transparent border-none p-0 hover:text-accent"
            @click="toggleSkill"
          >
            ▸ プロンプト展開（{{ getTextContent(entry).length }}文字）
          </button>
        </div>
      </template>
      <!-- スキル展開済み -->
      <template v-else-if="isSkillPrompt(entry)">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-accent font-mono text-sm">{{ getSkillName(entry) }}</span>
          <button
            class="text-text-dim text-xs cursor-pointer bg-transparent border-none p-0 hover:text-accent"
            @click="toggleSkill"
          >
            ▾ 折りたたむ
          </button>
        </div>
        <div
          class="whitespace-pre-wrap break-words text-text text-xs opacity-70"
          v-html="highlightText(getTextContent(entry), searchText)"
        ></div>
      </template>
      <!-- 通常メッセージ -->
      <template v-else>
        <div
          class="whitespace-pre-wrap break-words text-text"
          v-html="highlightText(getTextContent(entry), searchText)"
        ></div>
      </template>
    </template>

    <!-- ツール実行（テキストなし） -->
    <div v-if="hasOnlyToolUse(entry)" class="flex flex-col gap-1 mt-1">
      <div
        v-for="(tool, ti) in getToolUseItems(entry)"
        :key="ti"
        class="text-[#f0a500] text-xs font-mono"
      >
        🔧 {{ getToolSummary(tool) }}
      </div>
    </div>

    <!-- テキストあり + ツールあり の場合はツール名を補足表示 -->
    <div v-else-if="isToolUse(entry) && getTextContent(entry)" class="mt-1.5 flex flex-wrap gap-1.5">
      <span
        v-for="(tool, ti) in getToolUseItems(entry)"
        :key="ti"
        class="text-[#f0a500] text-xs font-mono"
      >
        🔧 {{ getToolSummary(tool) }}
      </span>
    </div>
  </div>
</template>
