<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

/**
 * A borda da faixa não é enfeite: no modo escuro o fundo dela é `gray-900`, igual ao do cartão do
 * cadastro público, e sem ela as abas se fundem no cartão. A aba escolhida usa `ring` e não
 * `border` porque anel não ocupa espaço, senão a faixa treme a cada troca.
 */
export interface FormTab<T extends string> {
  id: T
  label: string
  icon: Component
}

defineProps<{
  modelValue: T
  tabs: Array<FormTab<T>>
  ariaLabel: string
  /** Numera os rótulos. Só para formulário em etapas; em seções independentes sugere ordem que não existe. */
  numbered?: boolean
}>()

defineEmits<{ 'update:modelValue': [T] }>()
</script>

<template>
  <div
    class="mb-5 flex rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-900"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="(tab, index) in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-label="tab.label"
      :title="tab.label"
      :aria-selected="modelValue === tab.id"
      class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
      :class="
        modelValue === tab.id
          ? 'bg-white text-primary-700 shadow-sm ring-1 ring-gray-200 dark:bg-gray-700 dark:text-primary-300 dark:ring-gray-600'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
      "
      @click="$emit('update:modelValue', tab.id)"
    >
      <component :is="tab.icon" :size="17" aria-hidden="true" />
      <span class="hidden sm:inline">{{ numbered ? `${index + 1}. ` : '' }}{{ tab.label }}</span>
    </button>
  </div>
</template>
