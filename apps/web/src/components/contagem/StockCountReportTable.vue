<script setup lang="ts">
import ExpandableText from '@/components/ui/ExpandableText.vue'
import { formatCurrency, formatQuantity } from '@/lib/format'
import { diferencaClasses, diferencaComSinal, tomDaDiferenca } from '@/lib/stockCount'
import type { StockCountItem } from '@/types'

defineProps<{ items: StockCountItem[]; loading: boolean }>()

/** Produto que ninguém contou não tem saldo, diferença nem valor: o traço evita rótulo órfão no celular. */
const SEM_VALOR = '-'

function saldoDoSistema(item: StockCountItem) {
  if (item.previousQuantity === null) return SEM_VALOR
  return `${formatQuantity(item.previousQuantity)} ${item.unitAbbreviation}`
}

function diferenca(item: StockCountItem) {
  if (item.difference === null) return SEM_VALOR
  return `${diferencaComSinal(item.difference)} ${item.unitAbbreviation}`
}

function valorDaDiferenca(item: StockCountItem) {
  if (item.difference === null) return SEM_VALOR
  if (item.differenceValue === null) return 'Sem custo cadastrado'
  return formatCurrency(item.differenceValue)
}
</script>

<template>
  <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
    <thead class="bg-gray-50 dark:bg-gray-900/60">
      <tr>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Produto</th>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Categoria</th>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
          Sistema tinha
        </th>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Contado</th>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Diferença</th>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Em dinheiro</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
      <tr v-if="loading">
        <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
      </tr>
      <tr v-else-if="items.length === 0">
        <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum produto neste filtro.
        </td>
      </tr>
      <tr v-for="item in items" v-else :key="item.productId">
        <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          <ExpandableText :text="item.productName" :max-length="45" />
        </td>
        <td class="max-w-56 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          <ExpandableText :text="item.categoryName" :max-length="30" />
        </td>
        <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {{ saldoDoSistema(item) }}
        </td>
        <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          {{ item.countedQuantity === null ? 'Não contado' : `${formatQuantity(item.countedQuantity)} ${item.unitAbbreviation}` }}
        </td>
        <td class="whitespace-nowrap px-4 py-3 text-sm font-medium" :class="diferencaClasses[tomDaDiferenca(item.difference)]">
          {{ diferenca(item) }}
        </td>
        <td class="whitespace-nowrap px-4 py-3 text-sm" :class="diferencaClasses[tomDaDiferenca(item.difference)]">
          {{ valorDaDiferenca(item) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
