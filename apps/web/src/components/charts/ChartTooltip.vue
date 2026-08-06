<script setup lang="ts">
defineProps<{
  visible: boolean
  x: number
  y: number
  title: string
  label: string
  value: string
  color: string
  detail?: string
  details?: string[]
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="pointer-events-none fixed z-[100] min-w-36 max-w-64 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-xl dark:border-gray-600 dark:bg-gray-900"
      :style="{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, calc(-100% - 10px))' }"
      role="tooltip"
    >
      <p class="mb-1 font-medium text-gray-900 dark:text-gray-100">{{ title }}</p>
      <div class="flex items-center justify-between gap-4">
        <span class="flex min-w-0 items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: color }" />
          <span class="truncate">{{ label }}</span>
        </span>
        <strong class="whitespace-nowrap text-gray-900 dark:text-gray-100">{{ value }}</strong>
      </div>
      <p v-if="detail" class="mt-1 text-gray-500 dark:text-gray-400">{{ detail }}</p>
      <ul v-if="details?.length" class="mt-1.5 space-y-0.5 border-t border-gray-100 pt-1.5 text-gray-600 dark:border-gray-700 dark:text-gray-300">
        <li v-for="(item, index) in details" :key="`${item}-${index}`" class="truncate">{{ item }}</li>
      </ul>
    </div>
  </Teleport>
</template>
