<script setup lang="ts">
defineProps<{
  text?: string
  required?: boolean
}>()
</script>

<template>
  <span v-if="text" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
    {{ text }}<span
      v-if="required"
      class="text-red-500 dark:text-red-400"
      title="Campo obrigatório"
      aria-label="campo obrigatório"
    >&nbsp;*</span>
  </span>
</template>
