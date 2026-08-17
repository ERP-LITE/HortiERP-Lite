<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Eye, FileText, Plus } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import ExportCsvButton from '@/components/ui/ExportCsvButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import type { PeriodValue } from '@/lib/period'
import { formatDate } from '@/lib/format'
import { getApiErrorMessage } from '@/services/api'
import { listAllStockEntries, listStockEntries } from '@/services/stockEntriesService'
import { csvNumber } from '@/lib/csv'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import { useTableSort } from '@/composables/useTableSort'
import type { StockEntrySummary } from '@/types'

const { page, pageSize, total, totalPages, applyMeta, watchSearch } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => { page.value = 1; return loadEntries() }, 'entryDate', 'desc')

const entries = ref<StockEntrySummary[]>([])
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')
function emptyFilters() {
  return { period: { preset: 'todos', from: '', to: '' } as PeriodValue }
}
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  emptyFilters,
  () => {
    page.value = 1
    loadEntries()
  },
)
const activeFilterCount = computed(() => Number(filters.value.period.preset !== 'todos'))

function itemsSummary(entry: StockEntrySummary) {
  return entry.items
    .map((item) => `${item.product.name} (${Number(item.quantity)} ${item.product.unit.abbreviation})`)
    .join(', ')
}

function hasInvoice(entry: StockEntrySummary) {
  return Boolean(entry.invoiceNumber || entry.invoiceAccessKey || entry.attachments?.length)
}

async function loadEntries() {
  loading.value = true
  try {
    const result = await listStockEntries({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      from: filters.value.period.from || undefined,
      to: filters.value.period.to || undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    entries.value = result.data
    applyMeta(result)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

watchSearch(search, loadEntries)
async function exportCsv() {
  const all = await listAllStockEntries({
    search: search.value || undefined,
    from: filters.value.period.from || undefined,
    to: filters.value.period.to || undefined,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  })

  return {
    headers: ['Data', 'Fornecedor', 'Nota', 'Serie', 'Produto', 'Quantidade', 'Custo unitario', 'Total do item', 'Recebido por', 'Observacoes'],
    rows: all.flatMap((entry) =>
      (entry.items ?? []).map((item) => [
        formatDate(entry.entryDate),
        entry.supplierName ?? '',
        entry.invoiceNumber ?? '',
        entry.invoiceSeries ?? '',
        item.product?.name ?? '',
        csvNumber(item.quantity, 3),
        csvNumber(item.unitCost),
        csvNumber(Number(item.quantity) * Number(item.unitCost ?? 0)),
        entry.createdByUser?.name ?? '',
        entry.notes ?? '',
      ]),
    ),
  }
}

onMounted(loadEntries)
</script>

<template>
  <div>
    <PageHeader title="Entradas de mercadoria" subtitle="Histórico de recebimentos de estoque">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar fornecedor, item ou nota..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <ExportCsvButton file-name="entradas" :load="exportCsv" />
        <RouterLink :to="{ name: 'entradas-nova' }">
          <BaseButton class="!px-2.5 sm:!px-4" title="Nova entrada" aria-label="Nova entrada">
            <Plus :size="16" /> <span class="hidden sm:inline">Nova entrada</span>
          </BaseButton>
        </RouterLink>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <SortableTableHeader field="entryDate" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Data</SortableTableHeader>
            <SortableTableHeader field="supplierName" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Fornecedor</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Itens</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Recebido por
            </th>
            <SortableTableHeader field="invoiceStatus" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Nota fiscal</SortableTableHeader>
            <th class="print:hidden px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="entries.length === 0">
            <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma entrada registrada.
            </td>
          </tr>
          <tr v-for="entry in entries" v-else :key="entry.id">
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatDate(entry.entryDate) }}
            </td>
            <td class="max-w-64 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="entry.supplierName" :max-length="40" />
            </td>
            <td class="max-w-80 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="itemsSummary(entry)" />
            </td>
            <td class="max-w-64 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
              <ExpandableText :text="entry.createdByUser?.name" :max-length="40" empty-text="Usuário não identificado" />
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge :variant="hasInvoice(entry) ? 'success' : 'neutral'">
                <FileText :size="13" /> {{ hasInvoice(entry) ? 'Com nota' : 'Sem nota' }}
              </BaseBadge>
            </td>
            <td class="print:hidden px-4 py-3 text-right">
              <RouterLink
                :to="{ name: 'entradas-detalhes', params: { id: entry.id } }"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Ver detalhes da entrada"
                aria-label="Ver detalhes da entrada"
              >
                <Eye :size="16" />
              </RouterLink>
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

    <BaseModal :open="filterModalOpen" title="Filtrar entradas" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <PeriodPicker v-model="draftFilters.period" />

        <div class="flex justify-between items-center pt-2">
          <button type="button" class="text-sm text-gray-500 hover:underline dark:text-gray-400" @click="clearFilters">
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
