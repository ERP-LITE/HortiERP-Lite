<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Search } from '@lucide/vue'

const props = defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const local = ref(props.modelValue)
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.modelValue,
  (value) => {
    if (value !== local.value) local.value = value
  },
)

watch(local, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => emit('update:modelValue', value), 400)
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="relative min-w-0 flex-1 sm:flex-none">
    <Search :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
    <input
      v-model="local"
      type="text"
      :placeholder="placeholder ?? 'Buscar...'"
      class="w-full sm:w-64 rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500"
    />
  </div>
</template>
