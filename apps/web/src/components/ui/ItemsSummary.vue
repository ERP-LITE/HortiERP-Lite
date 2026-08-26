<script setup lang="ts">
import { computed, ref } from 'vue'
import { List } from '@lucide/vue'
import { formatQuantity } from '@/lib/format'
import BaseModal from './BaseModal.vue'

export interface SummaryItem {
  name: string
  quantity: string | number
  unit?: string | null
}

const props = withDefaults(defineProps<{ items: SummaryItem[]; title?: string; emptyText?: string }>(), {
  title: 'Itens da entrada',
  emptyText: '—',
})

const aberto = ref(false)
const total = computed(() => props.items.length)
const resumo = computed(() => `${total.value} ${total.value === 1 ? 'item' : 'itens'}`)

function linha(item: SummaryItem) {
  return `${item.name} (${formatQuantity(item.quantity)}${item.unit ? ` ${item.unit}` : ''})`
}
</script>

<template>
  <span v-if="total === 0">{{ emptyText }}</span>
  <span v-else-if="total === 1" class="break-all">{{ linha(items[0]) }}</span>
  <template v-else>
    <button
      type="button"
      class="print:hidden inline-flex items-center gap-1 rounded font-medium text-primary-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400"
      :title="`Ver os ${resumo} desta entrada`"
      @click.stop="aberto = true"
    >
      {{ resumo }}
      <List :size="14" aria-hidden="true" />
    </button>

    <!-- No papel não há clique: a relação sai impressa no lugar do botão. -->
    <ul class="hidden print:block">
      <li v-for="(item, index) in items" :key="`${item.name}-${index}`" class="break-all">{{ linha(item) }}</li>
    </ul>

    <BaseModal :open="aberto" :title="title" size="sm" @close="aberto = false">
      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/60">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Produto
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Quantidade
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="(item, index) in items" :key="`${item.name}-${index}`">
              <td class="px-4 py-3 text-sm font-medium break-words text-gray-900 dark:text-gray-100">
                {{ item.name }}
              </td>
              <td class="px-4 py-3 text-right text-sm whitespace-nowrap text-gray-700 dark:text-gray-300">
                {{ formatQuantity(item.quantity) }} {{ item.unit }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseModal>
  </template>
</template>
