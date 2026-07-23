<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { getApiErrorMessage } from '@/services/api'
import {
  fetchLossesReport,
  fetchStockByCategoryReport,
  fetchStockEntriesReport,
  type LossesReport,
  type StockByCategoryRow,
} from '@/services/reportsService'
import type { StockEntry } from '@/types'

const tabs = [
  { key: 'estoque', label: 'Estoque por categoria' },
  { key: 'perdas', label: 'Perdas por período' },
  { key: 'entradas', label: 'Entradas por período' },
] as const

type TabKey = (typeof tabs)[number]['key']

const activeTab = ref<TabKey>('estoque')
const loading = ref(false)
const errorMessage = ref('')

const from = ref('')
const to = ref('')

const stockByCategory = ref<StockByCategoryRow[]>([])
const lossesReport = ref<LossesReport | null>(null)
const stockEntriesReport = ref<StockEntry[]>([])

const reasonLabels: Record<string, string> = {
  vencido: 'Vencido',
  avariado: 'Avariado',
  roubo_furto: 'Roubo/Furto',
  erro_operacional: 'Erro operacional',
  outro: 'Outro',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

async function loadStockByCategory() {
  stockByCategory.value = await fetchStockByCategoryReport()
}

async function loadLosses() {
  lossesReport.value = await fetchLossesReport({ from: from.value || undefined, to: to.value || undefined })
}

async function loadStockEntries() {
  stockEntriesReport.value = await fetchStockEntriesReport({ from: from.value || undefined, to: to.value || undefined })
}

async function loadActiveTab() {
  loading.value = true
  errorMessage.value = ''
  try {
    if (activeTab.value === 'estoque') await loadStockByCategory()
    if (activeTab.value === 'perdas') await loadLosses()
    if (activeTab.value === 'entradas') await loadStockEntries()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

watch(activeTab, loadActiveTab)
onMounted(loadActiveTab)
</script>

<template>
  <div>
    <PageHeader title="Relatórios" subtitle="Consolidados de estoque, perdas e entradas" />

    <div class="border-b border-gray-200 mb-6">
      <nav class="flex gap-6">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="pb-3 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="
            activeTab === tab.key
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <div v-if="activeTab !== 'estoque'" class="flex flex-wrap gap-4 mb-4">
      <BaseInput v-model="from" type="date" label="De" />
      <BaseInput v-model="to" type="date" label="Até" />
      <div class="flex items-end">
        <button class="text-sm text-primary-600 hover:underline" @click="loadActiveTab">Filtrar</button>
      </div>
    </div>

    <p v-if="errorMessage" class="text-sm text-red-600 mb-4">{{ errorMessage }}</p>
    <p v-else-if="loading" class="text-sm text-gray-500">Carregando...</p>

    <template v-else>
      <div v-if="activeTab === 'estoque'" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produtos</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="stockByCategory.length === 0">
              <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500">Sem dados.</td>
            </tr>
            <tr v-for="row in stockByCategory" v-else :key="row.categoryId">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ row.categoryName }}</td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ row.productCount }}</td>
              <td class="px-4 py-3 text-sm text-gray-700">{{ row.totalStock }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="activeTab === 'perdas' && lossesReport" class="space-y-6">
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200">
            <h2 class="text-sm font-semibold text-gray-700">Perdas por motivo</h2>
          </div>
          <table class="min-w-full divide-y divide-gray-100">
            <tbody class="divide-y divide-gray-100">
              <tr v-if="lossesReport.byReason.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 text-center">Sem perdas no período.</td>
              </tr>
              <tr v-for="row in lossesReport.byReason" v-else :key="row.reason">
                <td class="px-4 py-3 text-sm text-gray-900">{{ reasonLabels[row.reason] ?? row.reason }}</td>
                <td class="px-4 py-3 text-sm text-gray-500 text-right">{{ row.occurrences }} registros</td>
                <td class="px-4 py-3 text-sm text-gray-700 text-right">{{ row.quantity }} un.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200">
            <h2 class="text-sm font-semibold text-gray-700">Detalhamento</h2>
          </div>
          <table class="min-w-full divide-y divide-gray-100">
            <tbody class="divide-y divide-gray-100">
              <tr v-if="lossesReport.items.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 text-center">Sem perdas no período.</td>
              </tr>
              <tr v-for="loss in lossesReport.items" v-else :key="loss.id">
                <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{{ formatDate(loss.lossDate) }}</td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ loss.product?.name }}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <BaseBadge variant="danger">{{ reasonLabels[loss.reason] ?? loss.reason }}</BaseBadge>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700 text-right">{{ Number(loss.quantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else-if="activeTab === 'entradas'" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Itens</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="stockEntriesReport.length === 0">
              <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500">Sem entradas no período.</td>
            </tr>
            <tr v-for="entry in stockEntriesReport" v-else :key="entry.id">
              <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{{ formatDate(entry.entryDate) }}</td>
              <td class="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                {{ entry.supplierName || '—' }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">
                {{ entry.items.map((item) => `${item.product.name} (${Number(item.quantity)})`).join(', ') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
