<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronsUpDown } from '@lucide/vue'
import type { SortOrder } from '@/composables/useTableSort'

const props = defineProps<{
  field: string
  activeField?: string
  order: SortOrder
  align?: 'left' | 'right'
}>()

defineEmits<{ sort: [field: string] }>()
</script>

<template>
  <th class="px-4 py-3 text-xs font-medium uppercase text-gray-500 dark:text-gray-400" :class="props.align === 'right' ? 'text-right' : 'text-left'">
    <button
      type="button"
      class="inline-flex items-center gap-1 uppercase hover:text-gray-900 focus:outline-none focus-visible:text-primary-700 dark:hover:text-gray-100 dark:focus-visible:text-primary-400"
      :class="props.align === 'right' ? 'flex-row-reverse' : ''"
      :aria-label="`Ordenar por ${String($slots.default?.()[0]?.children ?? field)}`"
      @click="$emit('sort', field)"
    >
      <slot />
      <ArrowUp v-if="activeField === field && order === 'asc'" :size="13" aria-hidden="true" />
      <ArrowDown v-else-if="activeField === field" :size="13" aria-hidden="true" />
      <ChevronsUpDown v-else :size="13" class="opacity-45" aria-hidden="true" />
    </button>
  </th>
</template>
