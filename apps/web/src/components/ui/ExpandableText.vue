<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown } from '@lucide/vue'

const props = withDefaults(defineProps<{ text?: string | null; maxLength?: number; emptyText?: string }>(), {
  text: '',
  maxLength: 60,
  emptyText: '—',
})

const normalizedText = computed(() => props.text?.trim() || '')
const isLong = computed(() => normalizedText.value.length > props.maxLength)
const preview = computed(() => `${normalizedText.value.slice(0, props.maxLength).trimEnd()}…`)
</script>

<template>
  <span v-if="!normalizedText">{{ emptyText }}</span>
  <span v-else-if="!isLong" class="break-all">{{ normalizedText }}</span>
  <details v-else class="group relative min-w-0 max-w-80" @click.stop @dblclick.stop>
    <summary
      class="cursor-pointer list-none rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 group-open:absolute group-open:right-0 group-open:top-0"
      title="Clique para ler o texto completo"
    >
      <span class="flex min-w-0 items-center gap-1">
        <span class="block min-w-0 flex-1 truncate group-open:hidden">{{ preview }}</span>
        <ChevronDown
          :size="14"
          aria-hidden="true"
          class="shrink-0 text-gray-400 transition-transform group-open:rotate-180 dark:text-gray-500"
        />
      </span>
    </summary>
    <p class="whitespace-pre-wrap break-all pr-5 text-left">{{ normalizedText }}</p>
  </details>
</template>

<style scoped>
summary::-webkit-details-marker {
  display: none;
}

@media print {
  details:not([open]) > :not(summary) {
    display: block;
  }

  summary {
    display: none;
  }
}
</style>
