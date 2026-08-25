<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    size?: 'sm' | 'md' | 'lg'
    fit?: boolean
  }>(),
  { size: 'md', fit: false },
)
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
const titleId = useId()
let previousFocus: HTMLElement | null = null
let previousOverflow = ''

const sizeClass = computed(() => ({ sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' })[props.size])

function close() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !panel.value) return

  const focusable = Array.from(
    panel.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  )
  if (!focusable.length) {
    event.preventDefault()
    panel.value.focus()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      await nextTick()
      panel.value?.focus()
    } else {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  },
)

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (props.open) document.body.style.overflow = previousOverflow
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40" @click="close" />
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        class="app-modal-scrollbar app-modal-panel relative w-full max-h-[95vh] rounded-xl bg-white shadow-lg outline-none dark:bg-gray-800"
        :class="[sizeClass, fit ? 'overflow-y-auto sm:flex sm:flex-col sm:overflow-hidden' : 'overflow-y-auto']"
      >
        <div
          class="flex shrink-0 items-start justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700"
        >
          <h2 :id="titleId" class="min-w-0 break-all text-lg font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h2>
          <button
            class="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none"
            type="button"
            aria-label="Fechar modal"
            @click="close"
          >
            <X :size="20" />
          </button>
        </div>
        <div class="p-6" :class="fit ? 'sm:flex sm:min-h-0 sm:flex-1 sm:flex-col' : ''">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
