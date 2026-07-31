<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'

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

const theme = useThemeStore()
const container = ref<HTMLElement | null>(null)
let widgetId: string | null = null
let pollId: ReturnType<typeof setInterval> | null = null
let mounted = false

function render() {
  if (!window.turnstile || !container.value) return

  widgetId = window.turnstile.render(container.value, {
    sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
    theme: theme.isDark ? 'dark' : 'light',
    callback: (token: string) => emit('verified', token),
    'expired-callback': () => emit('expired'),
    'error-callback': () => emit('expired'),
  })
}

function rerender() {
  if (!mounted || !window.turnstile || !container.value) return

  if (widgetId !== null) {
    window.turnstile.remove(widgetId)
    widgetId = null
  }

  emit('expired')
  render()
}

function reset() {
  if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId)
}

defineExpose({ reset })

onMounted(() => {
  mounted = true

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

watch(() => theme.isDark, rerender)

onBeforeUnmount(() => {
  mounted = false
  if (pollId) clearInterval(pollId)
  if (window.turnstile && widgetId !== null) window.turnstile.remove(widgetId)
})
</script>

<template>
  <div ref="container" />
</template>
