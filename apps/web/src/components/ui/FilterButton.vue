<script setup lang="ts">
import { Filter } from '@lucide/vue'
import CountBadge from '@/components/ui/CountBadge.vue'

defineProps<{ active?: number }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    title="Filtros"
    @click="$emit('click')"
  >
    <Filter :size="18" />
    <CountBadge :value="active ?? 0" />
  </button>
</template>
