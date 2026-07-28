<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Plus } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import type { PeriodValue } from '@/lib/period'
import { getApiErrorMessage } from '@/services/api'
import { listStockEntries } from '@/services/stockEntriesService'
import { usePagination } from '@/composables/usePagination'
import type { StockEntry } from '@/types'

const { page, pageSize, total, totalPages, applyMeta } = usePagination()

const entries = ref<StockEntry[]>([])
const loading = ref(true)
const errorMessage = ref('')

function emptyFilters() {
  return { search: '', period: { preset: 'todos', from: '', to: '' } as PeriodValue }
}
const filters = ref(emptyFilters())
const draftFilters = ref(emptyFilters())
const filterModalOpen = ref(false)
const activeFilterCount = computed(
  () => Number(filters.value.search !== '') + Number(filters.value.period.preset !== 'todos'),
)

function itemsSummary(entry: StockEntry) {
  return entry.items.map((item) => `${item.product.name} (${Number(item.quantity)})`).join(', ')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

async function loadEntries() {
  loading.value = true
  try {
    const result = await listStockEntries({
      page: page.value,
      pageSize: pageSize.value,
      search: filters.value.search || undefined,
      from: filters.value.period.from || undefined,
      to: filters.value.period.to || undefined,
    })
    entries.value = result.data
    applyMeta(result)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openFilterModal() {
  draftFilters.value = { ...filters.value }
  filterModalOpen.value = true
}

function applyFilters() {
  filters.value = { ...draftFilters.value }
  filterModalOpen.value = false
  page.value = 1
  loadEntries()
}

function clearFilters() {
  filters.value = emptyFilters()
  draftFilters.value = emptyFilters()
  filterModalOpen.value = false
  page.value = 1
  loadEntries()
}

watch([page, pageSize], loadEntries)
onMounted(loadEntries)
</script>

<template>
  <div>
    <PageHeader title="Entradas de mercadoria" subtitle="Histórico de recebimentos de estoque">
      <template #actions>
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
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
        <BaseInput v-model="draftFilters.search" label="Fornecedor" placeholder="Buscar..." />
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
