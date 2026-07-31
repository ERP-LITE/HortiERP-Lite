<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { History } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import { getApiErrorMessage } from '@/services/api'
import { listCurrentStock } from '@/services/stockService'
import { listCategories } from '@/services/categoriesService'
import { usePagination } from '@/composables/usePagination'
import type { Category, ProductWithRelations } from '@/types'

const { page, pageSize, total, totalPages, applyMeta } = usePagination()

const products = ref<ProductWithRelations[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')
const emptyFilters = { categoryId: 'todas', lowStockOnly: false }
const filters = ref({ ...emptyFilters })
const draftFilters = ref({ ...emptyFilters })
const filterModalOpen = ref(false)
const activeFilterCount = computed(
  () => Number(filters.value.categoryId !== 'todas') + Number(filters.value.lowStockOnly),
)
const categoryFilterOptions = computed(() => [
  { value: 'todas', label: 'Todas as categorias' },
  ...categories.value.map((c) => ({ value: c.id, label: c.name })),
])

async function loadStock() {
  loading.value = true
  try {
    const result = await listCurrentStock({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      categoryId: filters.value.categoryId !== 'todas' ? filters.value.categoryId : undefined,
      lowStockOnly: filters.value.lowStockOnly || undefined,
    })
    products.value = result.data
    applyMeta(result)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function loadCategoryOptions() {
  try {
    categories.value = (await listCategories({ page: 1, pageSize: 100 })).data
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
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
  loadStock()
}

function clearFilters() {
  filters.value = { ...emptyFilters }
  draftFilters.value = { ...emptyFilters }
  filterModalOpen.value = false
  page.value = 1
  loadStock()
}

watch(search, () => {
  if (page.value !== 1) page.value = 1
  else loadStock()
})
watch([page, pageSize], loadStock)
onMounted(() => {
  loadStock()
  loadCategoryOptions()
})
</script>

<template>
  <div>
    <PageHeader title="Estoque atual" subtitle="Situação de estoque por produto">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por produto..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <RouterLink
          :to="{ name: 'movimentacoes' }"
          class="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 sm:px-4"
          title="Ver histórico de movimentações"
          aria-label="Ver histórico de movimentações"
        >
          <History :size="18" /> <span class="hidden sm:inline">Ver histórico</span>
        </RouterLink>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div class="divide-y divide-gray-100 dark:divide-gray-700 sm:hidden">
        <div v-if="loading" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</div>
        <div v-else-if="products.length === 0" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum produto cadastrado.
        </div>
        <article v-for="product in products" v-else :key="product.id" class="space-y-3 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ product.name }}</h2>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ product.category?.name }}</p>
            </div>
            <BaseBadge v-if="Number(product.currentStock) <= Number(product.minStock)" variant="warning">
              Estoque baixo
            </BaseBadge>
          </div>
          <dl class="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">Estoque atual</dt>
              <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ Number(product.currentStock) }} {{ product.unit?.abbreviation }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">Estoque mínimo</dt>
              <dd class="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                {{ Number(product.minStock) }} {{ product.unit?.abbreviation }}
              </dd>
            </div>
          </dl>
        </article>
      </div>
      <table class="hidden min-w-full divide-y divide-gray-200 dark:divide-gray-700 sm:table">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Produto
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Categoria
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Estoque atual
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Estoque mínimo
            </th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="products.length === 0">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum produto cadastrado.
            </td>
          </tr>
          <tr v-for="product in products" v-else :key="product.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
              {{ product.name }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ product.category?.name }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {{ Number(product.currentStock) }} {{ product.unit?.abbreviation }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ Number(product.minStock) }} {{ product.unit?.abbreviation }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge v-if="Number(product.currentStock) <= Number(product.minStock)" variant="warning">
                Estoque baixo
              </BaseBadge>
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

    <BaseModal :open="filterModalOpen" title="Filtrar estoque" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <BaseSelect v-model="draftFilters.categoryId" label="Categoria" :options="categoryFilterOptions" />
        <BaseToggle v-model="draftFilters.lowStockOnly" label="Somente estoque baixo" />

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
