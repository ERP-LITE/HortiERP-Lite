<script setup lang="ts">
import { Trash2, X } from '@lucide/vue'
import BaseButton from './BaseButton.vue'

defineProps<{
  count: number
  deleting?: boolean
}>()

defineEmits<{
  delete: []
  clear: []
}>()
</script>

<template>
  <div
    v-if="count > 0"
    class="print:hidden mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 dark:border-primary-800 dark:bg-primary-950/40"
  >
    <span class="text-sm font-medium text-primary-800 dark:text-primary-200">
      {{ count }} {{ count === 1 ? 'registro selecionado' : 'registros selecionados' }}
    </span>
    <div class="flex gap-2">
      <BaseButton variant="ghost" :disabled="deleting" @click="$emit('clear')">
        <X :size="16" /> Limpar
      </BaseButton>
      <BaseButton variant="danger" :disabled="deleting" @click="$emit('delete')">
        <Trash2 :size="16" /> {{ deleting ? 'Excluindo...' : 'Excluir selecionados' }}
      </BaseButton>
    </div>
  </div>
</template>
