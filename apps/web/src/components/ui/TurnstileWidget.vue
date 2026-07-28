<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const emit = defineEmits<{
  verified: [token: string]
  expired: []
}>()

const container = ref<HTMLElement | null>(null)
let widgetId: string | null = null
let pollId: ReturnType<typeof setInterval> | null = null

function render() {
  if (!window.turnstile || !container.value) return

  widgetId = window.turnstile.render(container.value, {
    sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
    callback: (token: string) => emit('verified', token),
    'expired-callback': () => emit('expired'),
    'error-callback': () => emit('expired'),
  })
}

function reset() {
  if (window.turnstile && widgetId) window.turnstile.reset(widgetId)
}

defineExpose({ reset })

onMounted(() => {
  if (window.turnstile) {
    render()
    return
  }

  pollId = setInterval(() => {
    if (window.turnstile) {
      if (pollId) clearInterval(pollId)
      render()
    }
  }, 100)
})

onBeforeUnmount(() => {
  if (pollId) clearInterval(pollId)
  if (window.turnstile && widgetId) window.turnstile.remove(widgetId)
})
</script>

<template>
  <div ref="container" />
</template>
