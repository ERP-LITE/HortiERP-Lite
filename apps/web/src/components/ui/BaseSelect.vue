<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

defineProps<{
  modelValue: string
  label?: string
  required?: boolean
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ label }}</span>
    <div class="relative">
      <select
        :value="modelValue"
        :required="required"
        class="w-full appearance-none rounded-lg border border-gray-300 pl-3.5 pr-10 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
        :class="{ 'border-red-400': error }"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>{{ placeholder ?? 'Selecione...' }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <ChevronDown
        :size="16"
        class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
      />
    </div>
    <span v-if="error" class="block text-xs text-red-600 mt-1">{{ error }}</span>
  </label>
</template>
