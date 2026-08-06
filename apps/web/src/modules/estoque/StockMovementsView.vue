<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import type { PeriodValue } from '@/lib/period'
import { formatDateTime } from '@/lib/format'
import { getApiErrorMessage } from '@/services/api'
import { listStockMovements } from '@/services/stockService'
import { listAllProducts } from '@/services/productsService'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import type { MovementType, Product, StockMovement } from '@/types'

const { page, pageSize, total, totalPages, applyMeta, watchSearch } = usePagination()

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
  () => {
    page.value = 1
    loadMovements()
  },
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
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
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
                {{ formatDateTime(movement.createdAt) }}
              </p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Por {{ movement.createdByUser?.name || 'Usuário não identificado' }}
              </p>
            </div>
            <BaseBadge :variant="typeVariant[movement.type]">{{ typeLabels[movement.type] }}</BaseBadge>
          </div>
          <dl class="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">Quantidade</dt>
              <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ Number(movement.quantity) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">Saldo após</dt>
              <dd class="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{{ Number(movement.balanceAfter) }}</dd>
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
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Produto
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Usuário
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Quantidade
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Saldo após
            </th>
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
              {{ formatDateTime(movement.createdAt) }}
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
              {{ Number(movement.quantity) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ Number(movement.balanceAfter) }}
            </td>
            <td class="max-w-80 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="movement.notes" />
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

    <BaseModal :open="filterModalOpen" title="Filtrar movimentações" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <BaseSelect v-model="draftFilters.productId" label="Produto" :options="productFilterOptions" />
        <BaseSelect v-model="draftFilters.type" label="Tipo" :options="typeFilterOptions" />
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
