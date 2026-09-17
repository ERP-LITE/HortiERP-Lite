<script setup lang="ts">
import { Check } from '@lucide/vue'
import { CLASSE_CAMPO_COM_ERRO } from './fieldClasses'

/** `button` com `role="checkbox"`, e não `input`: a marca desenhada vale igual nos dois temas. */
defineProps<{
  checked: boolean
  label: string
  /** Deixa a caixa vermelha, no mesmo padrão dos demais campos com erro. */
  invalid?: boolean
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
    :class="[
      checked
        ? 'border-primary-600 bg-primary-600 text-white hover:border-primary-700 hover:bg-primary-700'
        : 'border-gray-300 bg-gray-100 text-transparent hover:border-gray-400 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600',
      invalid ? CLASSE_CAMPO_COM_ERRO : '',
    ]"
    @click="$emit('toggle')"
  >
    <Check v-if="checked" :size="13" :stroke-width="3" aria-hidden="true" />
  </button>
</template>
