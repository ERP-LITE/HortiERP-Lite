<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
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
          <BaseButton>+ Nova entrada</BaseButton>
        </RouterLink>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 mb-4">{{ errorMessage }}</p>

    <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Itens</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500">Carregando...</td>
          </tr>
          <tr v-else-if="entries.length === 0">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500">Nenhuma entrada registrada.</td>
          </tr>
          <tr v-for="entry in entries" v-else :key="entry.id">
            <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{{ formatDate(entry.entryDate) }}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
              {{ entry.supplierName || '—' }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ itemsSummary(entry) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
