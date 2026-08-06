<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { pendingApiRequests } from '@/services/api'

const visible = ref(false)
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let shownAt = 0

watch(
  pendingApiRequests,
  (pending) => {
    if (pending > 0) {
      if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
      if (!visible.value && !showTimer) {
        showTimer = setTimeout(() => {
          visible.value = pendingApiRequests.value > 0
          if (visible.value) shownAt = Date.now()
          showTimer = null
        }, 180)
      }
      return
    }

    if (showTimer) {
      clearTimeout(showTimer)
      showTimer = null
    }
    const remaining = Math.max(0, 300 - (Date.now() - shownAt))
    if (visible.value && remaining > 0) {
      hideTimer = setTimeout(() => {
        visible.value = false
        hideTimer = null
      }, remaining)
    } else {
      visible.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (showTimer) clearTimeout(showTimer)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<template>
  <div
    v-if="visible"
    class="pointer-events-none fixed inset-x-0 top-0 z-[110] h-0.5 overflow-hidden bg-primary-100 dark:bg-primary-950"
    role="progressbar"
    aria-label="Carregando dados"
  >
    <div class="global-request-indicator h-full w-1/3 bg-primary-600 dark:bg-primary-400" />
  </div>
</template>

<style scoped>
.global-request-indicator {
  animation: global-request-progress 1.1s ease-in-out infinite;
}

@keyframes global-request-progress {
  from { transform: translateX(-110%); }
  to { transform: translateX(410%); }
}

@media (prefers-reduced-motion: reduce) {
  .global-request-indicator {
    width: 100%;
    animation: none;
  }
}
</style>
