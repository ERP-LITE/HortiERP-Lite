<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import DateInput from '@/components/ui/DateInput.vue'
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
const filterModalOpen = ref(false)
const draftFrom = ref('')
const draftTo = ref('')
const hasDateFilterTab = computed(() => activeTab.value !== 'estoque')
const activeFilterCount = computed(() => Number(Boolean(from.value)) + Number(Boolean(to.value)))

function openFilterModal() {
  draftFrom.value = from.value
  draftTo.value = to.value
  filterModalOpen.value = true
}

function applyFilters() {
  from.value = draftFrom.value
  to.value = draftTo.value
  filterModalOpen.value = false
  loadActiveTab()
}

function clearFilters() {
  draftFrom.value = ''
  draftTo.value = ''
}

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
    <PageHeader title="Relatórios" subtitle="Consolidados de estoque, perdas e entradas">
      <template v-if="hasDateFilterTab" #actions>
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
      </template>
    </PageHeader>

    <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
      <nav class="flex gap-6">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="pb-3 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="
            activeTab === tab.key
              ? 'border-primary-600 text-primary-700 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <p v-if="activeFilterCount > 0 && hasDateFilterTab" class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      Período: {{ from ? formatDate(from) : 'início' }} até {{ to ? formatDate(to) : 'hoje' }}
    </p>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>
    <p v-else-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>

    <template v-else>
      <div
        v-if="activeTab === 'estoque'"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/60">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Categoria
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Produtos
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Estoque total
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="stockByCategory.length === 0">
              <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Sem dados.</td>
            </tr>
            <tr v-for="row in stockByCategory" v-else :key="row.categoryId">
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ row.categoryName }}</td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ row.productCount }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ row.totalStock }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="activeTab === 'perdas' && lossesReport" class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Perdas por motivo</h2>
          </div>
          <table class="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="lossesReport.byReason.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Sem perdas no período.
                </td>
              </tr>
              <tr v-for="row in lossesReport.byReason" v-else :key="row.reason">
                <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {{ reasonLabels[row.reason] ?? row.reason }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-right">
                  {{ row.occurrences }} registros
                </td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right">{{ row.quantity }} un.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Detalhamento</h2>
          </div>
          <table class="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="lossesReport.items.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Sem perdas no período.
                </td>
              </tr>
              <tr v-for="loss in lossesReport.items" v-else :key="loss.id">
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {{ formatDate(loss.lossDate) }}
                </td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ loss.product?.name }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <BaseBadge variant="danger">{{ reasonLabels[loss.reason] ?? loss.reason }}</BaseBadge>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right">
                  {{ Number(loss.quantity) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        v-else-if="activeTab === 'entradas'"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/60">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Data
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Fornecedor
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Itens
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="stockEntriesReport.length === 0">
              <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Sem entradas no período.
              </td>
            </tr>
            <tr v-for="entry in stockEntriesReport" v-else :key="entry.id">
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ formatDate(entry.entryDate) }}
              </td>
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {{ entry.supplierName || '—' }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {{ entry.items.map((item) => `${item.product.name} (${Number(item.quantity)})`).join(', ') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <BaseModal :open="filterModalOpen" title="Filtrar por período" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <div class="grid grid-cols-2 gap-4">
          <DateInput v-model="draftFrom" label="De" />
          <DateInput v-model="draftTo" label="Até" />
        </div>

        <div class="flex justify-between items-center pt-2">
          <button
            type="button"
            class="text-sm text-gray-500 hover:underline dark:text-gray-400"
            @click="clearFilters"
          >
            Limpar
          </button>
          <div class="flex gap-2">
            <BaseButton variant="secondary" type="button" @click="filterModalOpen = false">Cancelar</BaseButton>
            <BaseButton type="submit">Aplicar</BaseButton>
          </div>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
