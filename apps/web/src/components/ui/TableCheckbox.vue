<script setup lang="ts">
import { Check } from '@lucide/vue'

defineProps<{
  checked: boolean
  label: string
}>()

defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="checked"
    :aria-label="label"
    class="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
    :class="
      checked
        ? 'border-primary-600 bg-primary-600 text-white hover:border-primary-700 hover:bg-primary-700'
        : 'border-gray-300 bg-gray-100 text-transparent hover:border-gray-400 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600'
    "
    @click="$emit('toggle')"
  >
    <Check v-if="checked" :size="13" :stroke-width="3" aria-hidden="true" />
  </button>
</template>
