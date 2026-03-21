<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  text: string
}>()

const visible = ref(false)
const x = ref(0)
const y = ref(0)

function onEnter(e: MouseEvent) {
  x.value = e.clientX
  y.value = e.clientY - 8
  visible.value = true
}

function onMove(e: MouseEvent) {
  x.value = e.clientX
  y.value = e.clientY - 8
}

function onLeave() {
  visible.value = false
}
</script>

<template>
  <span
    class="inline-block"
    @mouseenter="onEnter"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <slot />
    <Teleport to="body">
      <div
        v-if="visible && text"
        class="fixed z-50 px-2.5 py-1.5 rounded text-xs text-white bg-[#111] border border-[#444] shadow-lg max-w-80 break-words pointer-events-none whitespace-pre-wrap"
        :style="{ left: x + 12 + 'px', top: y + 'px', transform: 'translateY(-100%)' }"
      >
        {{ text }}
      </div>
    </Teleport>
  </span>
</template>
