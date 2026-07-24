<script setup lang="ts">
import { computed } from 'vue'
import { Calendar } from '@lucide/vue'

const props = defineProps<{ modelValue: string; label?: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const formatted = computed(() => {
  if (!props.modelValue) return ''
  const [year, month, day] = props.modelValue.split('-')
  return `${day}/${month}/${year}`
})
</script>

<template>
  <label class="block">
    <span v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ label }}</span>
    <div class="relative">
      <input
        :value="modelValue"
        type="date"
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <div
        class="pointer-events-none flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        :class="formatted ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'"
      >
        <span>{{ formatted || 'dd/mm/aaaa' }}</span>
        <Calendar :size="16" class="text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  </label>
</template>
