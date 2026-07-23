<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Plus } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { getApiErrorMessage } from '@/services/api'
import { listStockEntries } from '@/services/stockEntriesService'
import type { StockEntry } from '@/types'

const entries = ref<StockEntry[]>([])
const loading = ref(true)
const errorMessage = ref('')

function itemsSummary(entry: StockEntry) {
  return entry.items.map((item) => `${item.product.name} (${Number(item.quantity)})`).join(', ')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

async function loadEntries() {
  loading.value = true
  try {
    entries.value = await listStockEntries()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(loadEntries)
</script>

<template>
  <div>
    <PageHeader title="Entradas de mercadoria" subtitle="Histórico de recebimentos de estoque">
      <template #actions>
        <RouterLink :to="{ name: 'entradas-nova' }">
          <BaseButton><Plus :size="16" /> Nova entrada</BaseButton>
        </RouterLink>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Fornecedor
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Itens</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="entries.length === 0">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma entrada registrada.
            </td>
          </tr>
          <tr v-for="entry in entries" v-else :key="entry.id">
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatDate(entry.entryDate) }}
            </td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
              {{ entry.supplierName || '—' }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ itemsSummary(entry) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
