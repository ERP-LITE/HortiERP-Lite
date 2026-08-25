<script setup lang="ts">
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: []; apply: []; clear: [] }>()
</script>

<template>
  <BaseModal :open="open" :title="title" @close="emit('close')">
    <form class="space-y-4" novalidate @submit.prevent="emit('apply')">
      <slot />
      <div class="flex items-center justify-between pt-2">
        <button type="button" class="text-sm text-gray-500 hover:underline dark:text-gray-400" @click="emit('clear')">
          Limpar
        </button>
        <div class="flex gap-2">
          <BaseButton variant="secondary" type="button" @click="emit('close')">Cancelar</BaseButton>
          <BaseButton type="submit">Aplicar</BaseButton>
        </div>
      </div>
    </form>
  </BaseModal>
</template>
