<script setup lang="ts">
defineProps<{
  label: string
  wide?: boolean
  mono?: boolean
}>()
</script>

<template>
  <div :class="wide ? 'sm:col-span-2' : ''">
    <dt class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ label }}</dt>
    <dd
      class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100"
      :class="mono ? 'break-all font-mono text-xs' : 'break-words'"
    >
      <slot />
    </dd>
  </div>
</template>
