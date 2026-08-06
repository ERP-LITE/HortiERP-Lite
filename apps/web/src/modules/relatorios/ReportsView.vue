<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Boxes, FileDown, Package, ReceiptText, Scale, TriangleAlert } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import Pagination from '@/components/ui/Pagination.vue'
import StatCard from '@/components/ui/StatCard.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import { useLocalTableSort } from '@/composables/useTableSort'
import type { PeriodValue } from '@/lib/period'
import { formatDate, formatDateOnly } from '@/lib/format'
import { getApiErrorMessage } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
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
const auth = useAuthStore()
const { page, pageSize, total, totalPages, applyMeta } = usePagination()
const loading = ref(false)
const generatingPdf = ref(false)
const printing = ref(false)
const generatedAt = ref('')
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
const printLossItems = ref<LossesReport['data']>([])
const printStockEntries = ref<StockEntry[]>([])

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

const filteredLossItems = computed(() => (printing.value ? printLossItems.value : lossesReport.value?.data ?? []))

const filteredStockEntries = computed(() => (printing.value ? printStockEntries.value : stockEntriesReport.value))
const lossReasonRows = computed(() => lossesReport.value?.byReason ?? [])

const stockSort = useLocalTableSort(filteredStockByCategory, {
  category: (row) => row.categoryName,
  products: (row) => row.productCount,
  stock: (row) => row.totalStock,
}, 'category')
const reasonSort = useLocalTableSort(lossReasonRows, {
  reason: (row) => reasonLabels[row.reason] ?? row.reason,
  occurrences: (row) => row.occurrences,
  quantity: (row) => row.quantity,
}, 'reason')
const lossSort = useLocalTableSort(filteredLossItems, {
  date: (row) => new Date(row.lossDate).getTime(),
  product: (row) => row.product?.name ?? '',
  reason: (row) => reasonLabels[row.reason] ?? row.reason,
  quantity: (row) => Number(row.quantity),
  user: (row) => row.createdByUser?.name ?? '',
}, 'date')
const entrySort = useLocalTableSort(filteredStockEntries, {
  date: (row) => new Date(row.entryDate).getTime(),
  supplier: (row) => row.supplierName ?? '',
  items: (row) => row.items.length,
  user: (row) => row.createdByUser?.name ?? '',
}, 'date')

const stockSummary = computed(() => ({
  categories: filteredStockByCategory.value.length,
  products: filteredStockByCategory.value.reduce((sum, row) => sum + row.productCount, 0),
  quantity: filteredStockByCategory.value.reduce((sum, row) => sum + row.totalStock, 0),
}))

const lossSummary = computed(() => {
  const rows = lossesReport.value?.byReason ?? []
  const occurrences = rows.reduce((sum, row) => sum + row.occurrences, 0)
  const quantity = rows.reduce((sum, row) => sum + row.quantity, 0)
  const mainReason = [...rows].sort((a, b) => b.quantity - a.quantity)[0]
  return { occurrences, quantity, mainReason: mainReason ? reasonLabels[mainReason.reason] ?? mainReason.reason : '—' }
})

const entriesSummary = computed(() => {
  const entries = printing.value ? printStockEntries.value : stockEntriesReport.value
  return {
    total: total.value,
    suppliers: new Set(entries.map((entry) => entry.supplierName).filter(Boolean)).size,
    quantity: entries.reduce(
      (sum, entry) => sum + entry.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0),
      0,
    ),
  }
})

const activeTabLabel = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.label ?? 'Relatório')
const periodLabel = computed(() => {
  if (!hasDateFilterTab.value || activeFilterCount.value === 0) return 'Todo o período'
  return `${from.value ? formatDateOnly(from.value) : 'início'} até ${to.value ? formatDateOnly(to.value) : 'hoje'}`
})

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

async function loadAllLossesForPdf() {
  const first = await fetchLossesReport({
    from: from.value || undefined,
    to: to.value || undefined,
    search: search.value || undefined,
    page: 1,
    pageSize: 100,
  })
  const data = [...first.data]
  for (let nextPage = 2; nextPage <= first.totalPages; nextPage += 1) {
    const result = await fetchLossesReport({
      from: from.value || undefined,
      to: to.value || undefined,
      search: search.value || undefined,
      page: nextPage,
      pageSize: 100,
    })
    data.push(...result.data)
  }
  printLossItems.value = data
}

async function loadAllEntriesForPdf() {
  const first = await fetchStockEntriesReport({
    from: from.value || undefined,
    to: to.value || undefined,
    search: search.value || undefined,
    page: 1,
    pageSize: 100,
  })
  const data = [...first.data]
  for (let nextPage = 2; nextPage <= first.totalPages; nextPage += 1) {
    const result = await fetchStockEntriesReport({
      from: from.value || undefined,
      to: to.value || undefined,
      search: search.value || undefined,
      page: nextPage,
      pageSize: 100,
    })
    data.push(...result.data)
  }
  printStockEntries.value = data
}

async function generatePdf() {
  generatingPdf.value = true
  errorMessage.value = ''
  try {
    if (activeTab.value === 'perdas') await loadAllLossesForPdf()
    if (activeTab.value === 'entradas') await loadAllEntriesForPdf()
    generatedAt.value = new Date().toLocaleString('pt-BR')
    printing.value = true
    await nextTick()

    const previousTitle = document.title
    document.title = `${activeTabLabel.value} - HortiERP Lite`
    window.addEventListener(
      'afterprint',
      () => {
        document.title = previousTitle
        printing.value = false
        generatingPdf.value = false
      },
      { once: true },
    )
    window.print()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
    generatingPdf.value = false
    printing.value = false
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
  <div class="reports-page">
    <PageHeader class="print:hidden" title="Relatórios" subtitle="Consolidados de estoque, perdas e entradas">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar..." />
        <FilterButton v-if="hasDateFilterTab" :active="activeFilterCount" @click="openFilterModal" />
        <BaseButton :disabled="loading || generatingPdf" title="Gerar PDF" @click="generatePdf">
          <FileDown :size="17" />
          <span class="hidden sm:inline">{{ generatingPdf ? 'Preparando...' : 'Gerar PDF' }}</span>
        </BaseButton>
      </template>
    </PageHeader>

    <section class="report-print-header hidden print:block">
      <div class="flex items-start justify-between gap-6 border-b border-gray-300 pb-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wider text-primary-700">HortiERP Lite</p>
          <h1 class="mt-1 text-2xl font-bold text-gray-900">{{ activeTabLabel }}</h1>
          <p class="mt-1 text-sm text-gray-600">{{ periodLabel }}</p>
        </div>
        <div class="text-right text-xs text-gray-500">
          <p>Emitido em {{ generatedAt }}</p>
          <p>Responsável: {{ auth.user?.name || 'Usuário não identificado' }}</p>
        </div>
      </div>
    </section>

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

    <p v-if="hasDateFilterTab" class="print:hidden text-sm text-gray-500 dark:text-gray-400 mb-4">
      Período: {{ periodLabel }}
    </p>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>
    <p v-else-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>

    <template v-else>
      <div v-if="activeTab === 'estoque'" class="report-summary-grid grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
        <StatCard label="Categorias" :value="String(stockSummary.categories)" :icon="Boxes" />
        <StatCard label="Produtos cadastrados" :value="String(stockSummary.products)" :icon="Package" />
        <StatCard label="Quantidade em estoque" :value="stockSummary.quantity.toLocaleString('pt-BR')" :icon="Scale" />
      </div>

      <div
        v-if="activeTab === 'estoque'"
        class="report-table bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/60">
            <tr>
              <SortableTableHeader field="category" :active-field="stockSort.sortBy.value" :order="stockSort.sortOrder.value" @sort="stockSort.toggleSort">Categoria</SortableTableHeader>
              <SortableTableHeader field="products" :active-field="stockSort.sortBy.value" :order="stockSort.sortOrder.value" @sort="stockSort.toggleSort">Produtos</SortableTableHeader>
              <SortableTableHeader field="stock" :active-field="stockSort.sortBy.value" :order="stockSort.sortOrder.value" @sort="stockSort.toggleSort">Estoque total</SortableTableHeader>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="filteredStockByCategory.length === 0">
              <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Sem dados.</td>
            </tr>
            <tr v-for="row in stockSort.sortedItems.value" v-else :key="row.categoryId">
              <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                <ExpandableText :text="row.categoryName" :max-length="45" />
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ row.productCount }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ row.totalStock }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="activeTab === 'perdas' && lossesReport" class="space-y-6">
        <div class="report-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Registros de perda" :value="String(lossSummary.occurrences)" :icon="ReceiptText" tone="danger" />
          <StatCard label="Quantidade perdida" :value="lossSummary.quantity.toLocaleString('pt-BR')" :icon="TriangleAlert" tone="danger" />
          <StatCard label="Principal motivo" :value="lossSummary.mainReason" :icon="Scale" tone="warning" />
        </div>

        <div class="report-table bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Perdas por motivo</h2>
          </div>
          <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <SortableTableHeader field="reason" :active-field="reasonSort.sortBy.value" :order="reasonSort.sortOrder.value" @sort="reasonSort.toggleSort">Motivo</SortableTableHeader>
                <SortableTableHeader field="occurrences" :active-field="reasonSort.sortBy.value" :order="reasonSort.sortOrder.value" align="right" @sort="reasonSort.toggleSort">Registros</SortableTableHeader>
                <SortableTableHeader field="quantity" :active-field="reasonSort.sortBy.value" :order="reasonSort.sortOrder.value" align="right" @sort="reasonSort.toggleSort">Quantidade</SortableTableHeader>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="lossesReport.byReason.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Sem perdas no período.
                </td>
              </tr>
              <tr v-for="row in reasonSort.sortedItems.value" v-else :key="row.reason">
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

        <div class="report-table bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Detalhamento</h2>
          </div>
          <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <SortableTableHeader field="date" :active-field="lossSort.sortBy.value" :order="lossSort.sortOrder.value" @sort="lossSort.toggleSort">Data</SortableTableHeader>
                <SortableTableHeader field="product" :active-field="lossSort.sortBy.value" :order="lossSort.sortOrder.value" @sort="lossSort.toggleSort">Produto</SortableTableHeader>
                <SortableTableHeader field="reason" :active-field="lossSort.sortBy.value" :order="lossSort.sortOrder.value" @sort="lossSort.toggleSort">Motivo</SortableTableHeader>
                <SortableTableHeader field="quantity" :active-field="lossSort.sortBy.value" :order="lossSort.sortOrder.value" align="right" @sort="lossSort.toggleSort">Quantidade</SortableTableHeader>
                <SortableTableHeader field="user" :active-field="lossSort.sortBy.value" :order="lossSort.sortOrder.value" @sort="lossSort.toggleSort">Registrado por</SortableTableHeader>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="filteredLossItems.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Sem perdas no período.
                </td>
              </tr>
              <tr v-for="loss in lossSort.sortedItems.value" v-else :key="loss.id">
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {{ formatDate(loss.lossDate) }}
                </td>
                <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  <ExpandableText :text="loss.product?.name" :max-length="45" />
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <BaseBadge variant="danger">{{ reasonLabels[loss.reason] ?? loss.reason }}</BaseBadge>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right">
                  {{ Number(loss.quantity) }}
                </td>
                <td class="max-w-64 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  <ExpandableText
                    :text="loss.createdByUser?.name"
                    :max-length="40"
                    empty-text="Usuário não identificado"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <Pagination
            v-if="!printing"
            :page="page"
            :page-size="pageSize"
            :total="total"
            :total-pages="totalPages"
            @update:page="page = $event"
            @update:page-size="pageSize = $event"
          />
        </div>
      </div>

      <div v-else-if="activeTab === 'entradas'" class="space-y-6">
        <div class="report-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Entradas registradas" :value="String(entriesSummary.total)" :icon="ReceiptText" />
          <StatCard
            :label="printing ? 'Fornecedores no relatório' : 'Fornecedores nesta página'"
            :value="String(entriesSummary.suppliers)"
            :icon="Boxes"
          />
          <StatCard
            :label="printing ? 'Quantidade recebida' : 'Quantidade nesta página'"
            :value="entriesSummary.quantity.toLocaleString('pt-BR')"
            :icon="Package"
          />
        </div>

        <div class="report-table bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/60">
            <tr>
              <SortableTableHeader field="date" :active-field="entrySort.sortBy.value" :order="entrySort.sortOrder.value" @sort="entrySort.toggleSort">Data</SortableTableHeader>
              <SortableTableHeader field="supplier" :active-field="entrySort.sortBy.value" :order="entrySort.sortOrder.value" @sort="entrySort.toggleSort">Fornecedor</SortableTableHeader>
              <SortableTableHeader field="items" :active-field="entrySort.sortBy.value" :order="entrySort.sortOrder.value" @sort="entrySort.toggleSort">Itens</SortableTableHeader>
              <SortableTableHeader field="user" :active-field="entrySort.sortBy.value" :order="entrySort.sortOrder.value" @sort="entrySort.toggleSort">Recebido por</SortableTableHeader>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="filteredStockEntries.length === 0">
              <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Sem entradas no período.
              </td>
            </tr>
            <tr v-for="entry in entrySort.sortedItems.value" v-else :key="entry.id">
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ formatDate(entry.entryDate) }}
              </td>
              <td class="max-w-64 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                <ExpandableText :text="entry.supplierName" :max-length="40" />
              </td>
              <td class="max-w-80 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                <ExpandableText
                  :text="entry.items.map((item) => `${item.product.name} (${Number(item.quantity)})`).join(', ')"
                />
              </td>
              <td class="max-w-64 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                <ExpandableText
                  :text="entry.createdByUser?.name"
                  :max-length="40"
                  empty-text="Usuário não identificado"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <Pagination
          v-if="!printing"
          :page="page"
          :page-size="pageSize"
          :total="total"
          :total-pages="totalPages"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
        </div>
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
