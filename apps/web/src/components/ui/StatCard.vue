<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    label: string
    value: string
    supportingText?: string
    tone?: 'default' | 'warning' | 'danger'
    icon?: Component
  }>(),
  { tone: 'default' },
)

const toneClasses: Record<string, string> = {
  default: 'text-gray-900 dark:text-gray-100',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
}

const iconToneClasses: Record<string, string> = {
  default: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ label }}</p>
        <p class="mt-2 text-2xl font-bold" :class="toneClasses[tone]">{{ value }}</p>
        <p v-if="supportingText" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ supportingText }}</p>
      </div>
      <div v-if="icon" class="shrink-0 rounded-lg p-2" :class="iconToneClasses[tone]">
        <component :is="icon" :size="20" />
      </div>
    </div>
  </div>
</template>
