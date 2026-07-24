<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { PAGE_SIZE_OPTIONS } from '@/composables/usePagination'

const props = defineProps<{
  page: number
  pageSize: number
  total: number
  totalPages: number
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
}>()

const rangeStart = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.total))

function goTo(page: number) {
  if (page < 1 || page > props.totalPages || page === props.page) return
  emit('update:page', page)
}
</script>

<template>
  <div
    class="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400"
  >
    <div class="flex items-center gap-3">
      <span>{{ total === 0 ? 'Nenhum registro' : `${rangeStart}–${rangeEnd} de ${total}` }}</span>
      <label class="flex items-center gap-1.5">
        <span class="hidden sm:inline">Por página</span>
        <select
          :value="pageSize"
          class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm py-1 px-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="inline-flex items-center justify-center h-8 w-8 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
        :disabled="page <= 1"
        title="Página anterior"
        @click="goTo(page - 1)"
      >
        <ChevronLeft :size="16" />
      </button>
      <span class="px-2 whitespace-nowrap">Página {{ total === 0 ? 0 : page }} de {{ totalPages }}</span>
      <button
        type="button"
        class="inline-flex items-center justify-center h-8 w-8 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
        :disabled="page >= totalPages"
        title="Próxima página"
        @click="goTo(page + 1)"
      >
        <ChevronRight :size="16" />
      </button>
    </div>
  </div>
</template>
