<script setup lang="ts">
defineProps<{ modelValue: boolean; label?: string }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="inline-flex items-center gap-3 cursor-pointer select-none">
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      :class="modelValue ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
        :class="modelValue ? 'translate-x-6' : 'translate-x-1'"
      />
    </button>
    <span v-if="label" class="text-sm text-gray-700 dark:text-gray-300">{{ label }}</span>
  </label>
</template>
