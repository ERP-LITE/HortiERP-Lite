<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import FilterModal from '@/components/ui/FilterModal.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import ExportCsvButton from '@/components/ui/ExportCsvButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import type { PeriodValue } from '@/lib/period'
import { formatDate, formatDateTime, formatQuantity } from '@/lib/format'
import { getApiErrorMessage } from '@/services/api'
import { listAllStockMovements, listStockMovements } from '@/services/stockService'
import { csvNumber } from '@/lib/csv'
import { listAllProducts } from '@/services/productsService'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import { useTableSort } from '@/composables/useTableSort'
import type { MovementType, Product, StockMovement } from '@/types'

const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()

function isBackdated(movement: StockMovement) {
  return formatDate(movement.movementDate) !== formatDate(movement.createdAt)
}

/** Data retroativa não tem hora conhecida: exibir 00:00 fingiria uma precisão que não existe. */
function movementDateLabel(movement: StockMovement) {
  return isBackdated(movement) ? formatDate(movement.movementDate) : formatDateTime(movement.movementDate)
}

const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadMovements), 'movementDate', 'desc')

const movements = ref<StockMovement[]>([])
const products = ref<Product[]>([])
const loading = ref(true)
const errorMessage = ref('')
const search = ref('')

const typeLabels: Record<MovementType, string> = {
  entrada: 'Entrada',
  perda: 'Perda',
  ajuste: 'Ajuste',
}

const typeVariant: Record<MovementType, 'success' | 'danger' | 'neutral'> = {
  entrada: 'success',
  perda: 'danger',
  ajuste: 'neutral',
}

const typeFilterOptions = [
  { value: 'todos', label: 'Todos os tipos' },
  { value: 'entrada', label: 'Entrada' },
  { value: 'perda', label: 'Perda' },
  { value: 'ajuste', label: 'Ajuste' },
]

function emptyFilters() {
  return { productId: 'todos', type: 'todos', period: { preset: 'todos', from: '', to: '' } as PeriodValue }
}
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  emptyFilters,
  () => reload(loadMovements),
)
const activeFilterCount = computed(
  () =>
    Number(filters.value.productId !== 'todos') +
    Number(filters.value.type !== 'todos') +
    Number(filters.value.period.preset !== 'todos'),
)
const productFilterOptions = computed(() => [
  { value: 'todos', label: 'Todos os produtos' },
  ...products.value.map((p) => ({ value: p.id, label: p.name })),
])

async function loadMovements() {
  loading.value = true
  try {
    const result = await listStockMovements({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      productId: filters.value.productId !== 'todos' ? filters.value.productId : undefined,
      type: filters.value.type !== 'todos' ? (filters.value.type as MovementType) : undefined,
      from: filters.value.period.from || undefined,
      to: filters.value.period.to || undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    movements.value = result.data
    applyMeta(result)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function loadProductOptions() {
  try {
    products.value = await listAllProducts()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

watchSearch(search, loadMovements)
async function exportCsv() {
  const all = await listAllStockMovements({
    search: search.value || undefined,
    productId: filters.value.productId !== 'todos' ? filters.value.productId : undefined,
    type: filters.value.type !== 'todos' ? (filters.value.type as MovementType) : undefined,
    from: filters.value.period.from || undefined,
    to: filters.value.period.to || undefined,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  })

  return {
    headers: ['Data', 'Produto', 'Tipo', 'Quantidade', 'Saldo apos', 'Usuario', 'Observacao'],
    rows: all.map((item) => [
      movementDateLabel(item),
      item.product?.name ?? '',
      typeLabels[item.type],
      csvNumber(item.quantity, 3),
      csvNumber(item.balanceAfter, 3),
      item.createdByUser?.name ?? 'Usuário não identificado',
      item.notes ?? '',
    ]),
  }
}

onMounted(() => {
  loadMovements()
  loadProductOptions()
})
</script>

<template>
  <div>
    <PageHeader title="Histórico de movimentações" subtitle="Todas as entradas, perdas e ajustes de estoque">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por produto..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <ExportCsvButton file-name="movimentacoes" :load="exportCsv" />
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <div class="divide-y divide-gray-100 dark:divide-gray-700 sm:hidden">
        <div v-if="loading" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</div>
        <div v-else-if="movements.length === 0" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhuma movimentação registrada.
        </div>
        <article v-for="movement in movements" v-else :key="movement.id" class="space-y-3 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <ExpandableText
                :text="movement.product?.name"
                :max-length="45"
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
              />
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {{ movementDateLabel(movement) }}
              </p>
              <p v-if="isBackdated(movement)" class="mt-0.5 text-xs text-amber-600 dark:text-amber-500">
                Lançado em {{ formatDateTime(movement.createdAt) }}
              </p>
              <div class="mt-0.5 flex min-w-0 items-start gap-1 text-xs text-gray-500 dark:text-gray-400">
                <span class="shrink-0">Por</span>
                <ExpandableText
                  :text="movement.createdByUser?.name"
                  :max-length="40"
                  empty-text="Usuário não identificado"
                />
              </div>
            </div>
            <BaseBadge :variant="typeVariant[movement.type]">{{ typeLabels[movement.type] }}</BaseBadge>
          </div>
          <dl class="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">Quantidade</dt>
              <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ formatQuantity(movement.quantity) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">Saldo após</dt>
              <dd class="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{{ formatQuantity(movement.balanceAfter) }}</dd>
            </div>
          </dl>
          <ExpandableText
            v-if="movement.notes"
            :text="movement.notes"
            :max-length="80"
            class="text-xs text-gray-500 dark:text-gray-400"
          />
        </article>
      </div>
      <table class="hidden min-w-full divide-y divide-gray-200 dark:divide-gray-700 sm:table">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <SortableTableHeader field="movementDate" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Data</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Produto
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Usuário
            </th>
            <SortableTableHeader field="type" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Tipo</SortableTableHeader>
            <SortableTableHeader field="quantity" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Quantidade</SortableTableHeader>
            <SortableTableHeader field="balanceAfter" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Saldo após</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Motivo
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="movements.length === 0">
            <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma movimentação registrada.
            </td>
          </tr>
          <tr v-for="movement in movements" v-else :key="movement.id">
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ movementDateLabel(movement) }}
              <span
                v-if="isBackdated(movement)"
                class="block text-xs text-amber-600 dark:text-amber-500"
                :title="`Data informada pelo usuário; o lançamento foi feito em ${formatDateTime(movement.createdAt)}`"
              >
                Lançado em {{ formatDateTime(movement.createdAt) }}
              </span>
            </td>
            <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="movement.product?.name" :max-length="45" />
            </td>
            <td class="max-w-64 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText
                :text="movement.createdByUser?.name"
                :max-length="40"
                empty-text="Usuário não identificado"
              />
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge :variant="typeVariant[movement.type]">{{ typeLabels[movement.type] }}</BaseBadge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {{ formatQuantity(movement.quantity) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatQuantity(movement.balanceAfter) }}
            </td>
            <td class="max-w-80 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="movement.notes" />
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-bind="paginationProps" />
    </div>

    <FilterModal
      :open="filterModalOpen"
      title="Filtrar movimentações"
      @close="filterModalOpen = false"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseSelect v-model="draftFilters.productId" label="Produto" :options="productFilterOptions" />
      <BaseSelect v-model="draftFilters.type" label="Tipo" :options="typeFilterOptions" />
      <PeriodPicker v-model="draftFilters.period" />
    </FilterModal>
  </div>
</template>
