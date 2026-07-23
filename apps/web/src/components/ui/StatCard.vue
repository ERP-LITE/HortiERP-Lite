<script setup lang="ts">
withDefaults(defineProps<{ label: string; value: string; tone?: 'default' | 'warning' | 'danger' }>(), {
  tone: 'default',
})

const toneClasses: Record<string, string> = {
  default: 'text-gray-900',
  warning: 'text-amber-600',
  danger: 'text-red-600',
}
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 p-5">
    <p class="text-sm text-gray-500">{{ label }}</p>
    <p class="mt-2 text-2xl font-bold" :class="toneClasses[tone]">{{ value }}</p>
  </div>
</template>
