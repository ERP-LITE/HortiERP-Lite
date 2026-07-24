<script setup lang="ts">
import { Filter } from '@lucide/vue'

defineProps<{ active?: number }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="relative inline-flex items-center justify-center h-10 w-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
    title="Filtros"
    @click="$emit('click')"
  >
    <Filter :size="18" />
    <span
      v-if="active"
      class="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary-600 text-white text-[10px] font-semibold leading-none"
    >
      {{ active }}
    </span>
  </button>
</template>
