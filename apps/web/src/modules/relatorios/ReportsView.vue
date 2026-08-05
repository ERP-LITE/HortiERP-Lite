<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import Pagination from '@/components/ui/Pagination.vue'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import type { PeriodValue } from '@/lib/period'
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
const { page, pageSize, total, totalPages, applyMeta } = usePagination()
const loading = ref(false)
const errorMessage = ref('')

function emptyPeriod(): PeriodValue {
  return { preset: 'todos', from: '', to: '' }
}
const {
  filters: period,
  draftFilters: draftPeriod,
  filterModalOpen,
  openFilterModal,
  applyFilters,
  clearFilters,
} = useFilterModal(emptyPeriod, () => {
  if (page.value !== 1) page.value = 1
  else loadActiveTab()
})
const hasDateFilterTab = computed(() => activeTab.value !== 'estoque')
const activeFilterCount = computed(() => Number(period.value.preset !== 'todos'))
const from = computed(() => period.value.from)
const to = computed(() => period.value.to)

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

const search = ref('')

function matches(text: string | null | undefined) {
  if (!search.value) return true
  return (text ?? '').toLowerCase().includes(search.value.toLowerCase())
}

const filteredStockByCategory = computed(() => stockByCategory.value.filter((row) => matches(row.categoryName)))

const filteredLossItems = computed(() =>
  lossesReport.value?.data ?? [],
)

const filteredStockEntries = computed(() => stockEntriesReport.value)

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function formatPeriodDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

async function loadStockByCategory() {
  stockByCategory.value = await fetchStockByCategoryReport()
}

async function loadLosses() {
  const result = await fetchLossesReport({
    from: from.value || undefined,
    to: to.value || undefined,
    search: search.value || undefined,
    page: page.value,
    pageSize: pageSize.value,
  })
  lossesReport.value = result
  applyMeta(result)
}

async function loadStockEntries() {
  const result = await fetchStockEntriesReport({
    from: from.value || undefined,
    to: to.value || undefined,
    search: search.value || undefined,
    page: page.value,
    pageSize: pageSize.value,
  })
  stockEntriesReport.value = result.data
  applyMeta(result)
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

watch(activeTab, () => {
  if (page.value !== 1) page.value = 1
  else loadActiveTab()
})
watch(search, () => {
  if (activeTab.value === 'estoque') return
  if (page.value !== 1) page.value = 1
  else loadActiveTab()
})
watch([page, pageSize], () => {
  if (activeTab.value !== 'estoque') loadActiveTab()
})
onMounted(loadActiveTab)
</script>

<template>
  <div>
    <PageHeader title="Relatórios" subtitle="Consolidados de estoque, perdas e entradas">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar..." />
        <FilterButton v-if="hasDateFilterTab" :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
      </template>
    </PageHeader>

    <div class="print:hidden border-b border-gray-200 dark:border-gray-700 mb-6">
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
      Período: {{ from ? formatPeriodDate(from) : 'início' }} até {{ to ? formatPeriodDate(to) : 'hoje' }}
    </p>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>
    <p v-else-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>

    <template v-else>
      <div
        v-if="activeTab === 'estoque'"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
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
            <tr v-if="filteredStockByCategory.length === 0">
              <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Sem dados.</td>
            </tr>
            <tr v-for="row in filteredStockByCategory" v-else :key="row.categoryId">
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
          <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-100 dark:divide-gray-700">
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
          <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="filteredLossItems.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Sem perdas no período.
                </td>
              </tr>
              <tr v-for="loss in filteredLossItems" v-else :key="loss.id">
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
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {{ loss.createdByUser?.name || 'Usuário não identificado' }}
                </td>
              </tr>
            </tbody>
          </table>
          <Pagination
            :page="page"
            :page-size="pageSize"
            :total="total"
            :total-pages="totalPages"
            @update:page="page = $event"
            @update:page-size="pageSize = $event"
          />
        </div>
      </div>

      <div
        v-else-if="activeTab === 'entradas'"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
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
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Recebido por
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="filteredStockEntries.length === 0">
              <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Sem entradas no período.
              </td>
            </tr>
            <tr v-for="entry in filteredStockEntries" v-else :key="entry.id">
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ formatDate(entry.entryDate) }}
              </td>
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {{ entry.supplierName || '—' }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {{ entry.items.map((item) => `${item.product.name} (${Number(item.quantity)})`).join(', ') }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ entry.createdByUser?.name || 'Usuário não identificado' }}
              </td>
            </tr>
          </tbody>
        </table>
        <Pagination
          :page="page"
          :page-size="pageSize"
          :total="total"
          :total-pages="totalPages"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </div>
    </template>

    <BaseModal :open="filterModalOpen" title="Filtrar por período" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <PeriodPicker v-model="draftPeriod" />

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
