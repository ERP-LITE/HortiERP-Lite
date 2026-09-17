<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ accept: string; multiple?: boolean; disabled?: boolean; icon?: Component }>()
const emit = defineEmits<{ select: [arquivos: File[]] }>()

function handleChange(event: Event) {
  const input = event.target as HTMLInputElement
  const arquivos = Array.from(input.files ?? [])
  // Limpar antes de qualquer saída: sem isso, escolher o mesmo arquivo de novo não dispara o evento.
  input.value = ''
  if (arquivos.length > 0) emit('select', arquivos)
}
</script>

<template>
  <label
    class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-600 transition-colors hover:border-primary-500 hover:text-primary-600 dark:border-gray-600 dark:text-gray-300"
    :class="disabled && 'pointer-events-none opacity-60'"
  >
    <component :is="icon" v-if="icon" :size="18" />
    <span><slot /></span>
    <input
      class="sr-only"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="handleChange"
    />
  </label>
</template>
