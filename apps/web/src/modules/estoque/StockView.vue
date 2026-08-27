<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { AlertTriangle, History, ListChecks, Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import FilterModal from '@/components/ui/FilterModal.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import ExportCsvButton from '@/components/ui/ExportCsvButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { toastSuccess } from '@/lib/alerts'
import { formatQuantity } from '@/lib/format'
import { adjustStock, listAllCurrentStock, listCurrentStock } from '@/services/stockService'
import { csvNumber } from '@/lib/csv'
import { listAllCategories } from '@/services/categoriesService'
import { listAllProducts } from '@/services/productsService'
import { useAsyncState } from '@/composables/useAsyncState'
import { usePermissions } from '@/composables/usePermissions'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import { useTableSort } from '@/composables/useTableSort'
import { LIMITES_NUMERO, LIMITES_TEXTO } from '@/lib/limits'
import type { Category, Product, ProductWithRelations } from '@/types'

const { canManage } = usePermissions()

const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadStock), 'name')

const products = ref<ProductWithRelations[]>([])
const categories = ref<Category[]>([])
const { loading, errorMessage, withLoading, captureError } = useAsyncState()

const search = ref('')
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  () => ({ categoryId: 'todas', lowStockOnly: false }),
  () => reload(loadStock),
)
const activeFilterCount = computed(
  () => Number(filters.value.categoryId !== 'todas') + Number(filters.value.lowStockOnly),
)
const categoryFilterOptions = computed(() => [
  { value: 'todas', label: 'Todas as categorias' },
  ...categories.value.map((c) => ({ value: c.id, label: c.name })),
])

async function loadStock() {
  await withLoading(async () => {
    const result = await listCurrentStock({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      categoryId: filters.value.categoryId !== 'todas' ? filters.value.categoryId : undefined,
      lowStockOnly: filters.value.lowStockOnly || undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    products.value = result.data
    applyMeta(result)
  })
}

async function loadCategoryOptions() {
  await captureError(async () => {
    categories.value = await listAllCategories()
  })
}

const allProducts = ref<Product[]>([])
async function loadAllProducts() {
  try {
    allProducts.value = await listAllProducts({ active: true })
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const adjustModalOpen = ref(false)
const adjustingProduct = ref<ProductWithRelations | null>(null)
const adjustForm = ref({ quantity: '', notes: '' })
const adjustFieldErrors = ref<Record<string, string>>({})
const adjustSaving = ref(false)
const adjustErrorMessage = ref('')

function openAdjustModal(product: ProductWithRelations) {
  adjustingProduct.value = product
  adjustForm.value = { quantity: product.currentStock, notes: '' }
  adjustFieldErrors.value = {}
  adjustErrorMessage.value = ''
  adjustModalOpen.value = true
}

function validateAdjustForm(): boolean {
  adjustFieldErrors.value = {}
  if (adjustForm.value.quantity === '' || Number(adjustForm.value.quantity) < 0) {
    adjustFieldErrors.value.quantity = 'Informe uma quantidade válida'
  }
  if (!adjustForm.value.notes.trim()) {
    adjustFieldErrors.value.notes = 'Explique o motivo do ajuste'
  }
  return Object.keys(adjustFieldErrors.value).length === 0
}

async function handleAdjustSubmit() {
  if (!adjustingProduct.value || !validateAdjustForm()) return

  adjustSaving.value = true
  adjustErrorMessage.value = ''
  try {
    await adjustStock({
      notes: adjustForm.value.notes.trim(),
      items: [{ productId: adjustingProduct.value.id, quantity: Number(adjustForm.value.quantity) }],
    })
    adjustModalOpen.value = false
    toastSuccess('Estoque ajustado com sucesso')
    await loadStock()
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível ajustar o estoque')
    adjustFieldErrors.value = result.fieldErrors
    adjustErrorMessage.value = result.message
  } finally {
    adjustSaving.value = false
  }
}

interface BulkAdjustItemRow {
  productId: string
  quantity: string
}

const bulkAdjustModalOpen = ref(false)
const bulkAdjustItems = ref<BulkAdjustItemRow[]>([])
const bulkAdjustNotes = ref('')
const bulkAdjustItemErrors = ref<{ productId?: string; quantity?: string }[]>([])
const bulkAdjustNotesError = ref('')
const bulkAdjustSaving = ref(false)
const bulkAdjustErrorMessage = ref('')

const bulkAdjustProductOptions = computed(() => allProducts.value.map((p) => ({ value: p.id, label: p.name })))

async function openBulkAdjustModal() {
  if (allProducts.value.length === 0) await loadAllProducts()
  bulkAdjustItems.value = [{ productId: '', quantity: '' }]
  bulkAdjustNotes.value = ''
  bulkAdjustItemErrors.value = []
  bulkAdjustNotesError.value = ''
  bulkAdjustErrorMessage.value = ''
  bulkAdjustModalOpen.value = true
}

function addBulkAdjustItem() {
  bulkAdjustItems.value.push({ productId: '', quantity: '' })
  bulkAdjustItemErrors.value = []
}

function removeBulkAdjustItem(index: number) {
  bulkAdjustItems.value.splice(index, 1)
  bulkAdjustItemErrors.value = []
}

function selectBulkAdjustProduct(index: number, productId: string) {
  const item = bulkAdjustItems.value[index]
  item.productId = productId
  const product = allProducts.value.find((p) => p.id === productId)
  if (product) item.quantity = product.currentStock
}

function validateBulkAdjustForm(): boolean {
  bulkAdjustItemErrors.value = bulkAdjustItems.value.map((item) => {
    const rowErrors: { productId?: string; quantity?: string } = {}
    if (!item.productId) rowErrors.productId = 'Selecione o produto'
    if (item.quantity === '' || Number(item.quantity) < 0) rowErrors.quantity = 'Informe uma quantidade válida'
    return rowErrors
  })
  bulkAdjustNotesError.value = bulkAdjustNotes.value.trim() ? '' : 'Explique o motivo do ajuste'

  return bulkAdjustItemErrors.value.every((rowErrors) => Object.keys(rowErrors).length === 0) && !bulkAdjustNotesError.value
}

async function handleBulkAdjustSubmit() {
  if (!validateBulkAdjustForm()) return

  bulkAdjustSaving.value = true
  bulkAdjustErrorMessage.value = ''
  try {
    const result = await adjustStock({
      notes: bulkAdjustNotes.value.trim(),
      items: bulkAdjustItems.value.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
    })
    bulkAdjustModalOpen.value = false
    toastSuccess(`${result.length} ${result.length === 1 ? 'produto ajustado' : 'produtos ajustados'} com sucesso`)
    await Promise.all([loadStock(), loadAllProducts()])
  } catch (error) {
    bulkAdjustErrorMessage.value = getApiErrorMessage(error, 'Não foi possível ajustar o estoque')
  } finally {
    bulkAdjustSaving.value = false
  }
}

watchSearch(search, loadStock)
async function exportCsv() {
  const all = await listAllCurrentStock({
    search: search.value || undefined,
    categoryId: filters.value.categoryId !== 'todas' ? filters.value.categoryId : undefined,
    lowStockOnly: filters.value.lowStockOnly || undefined,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  })

  return {
    headers: ['Produto', 'Categoria', 'Unidade', 'Estoque atual', 'Estoque minimo', 'Custo', 'Valor em estoque', 'Situacao'],
    rows: all.map((item) => [
      item.name,
      item.category?.name ?? '',
      item.unit?.name ?? '',
      csvNumber(item.currentStock, 3),
      csvNumber(item.minStock, 3),
      csvNumber(item.costPrice),
      csvNumber(Number(item.currentStock) * Number(item.costPrice ?? 0)),
      Number(item.currentStock) <= Number(item.minStock) ? 'Estoque baixo' : 'Normal',
    ]),
  }
}

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
        <ExportCsvButton file-name="estoque" :load="exportCsv" />
        <BaseButton
          v-if="canManage"
          variant="secondary"
          class="!px-2.5 sm:!px-4"
          title="Ajuste em lote"
          aria-label="Ajuste em lote"
          @click="openBulkAdjustModal"
        >
          <ListChecks :size="16" /> <span class="hidden sm:inline">Ajuste em lote</span>
        </BaseButton>
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

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <div class="divide-y divide-gray-100 dark:divide-gray-700 sm:hidden">
        <div v-if="loading" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</div>
        <div v-else-if="products.length === 0" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum produto cadastrado.
        </div>
        <article v-for="product in products" v-else :key="product.id" class="space-y-3 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ product.name }}</h2>
              <p class="mt-0.5 break-all text-xs text-gray-500 dark:text-gray-400">{{ product.category?.name }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <BaseBadge v-if="Number(product.currentStock) <= Number(product.minStock)" variant="warning">
                Estoque baixo
              </BaseBadge>
              <button
                v-if="canManage"
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Ajustar estoque"
                @click="openAdjustModal(product)"
              >
                <Pencil :size="16" />
              </button>
            </div>
          </div>
          <dl class="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">Estoque atual</dt>
              <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ formatQuantity(product.currentStock) }} {{ product.unit?.abbreviation }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">Estoque mínimo</dt>
              <dd class="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                {{ formatQuantity(product.minStock) }} {{ product.unit?.abbreviation }}
              </dd>
            </div>
          </dl>
        </article>
      </div>
      <table class="hidden min-w-full divide-y divide-gray-200 dark:divide-gray-700 sm:table">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <SortableTableHeader field="name" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Produto</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Categoria
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Unidade
            </th>
            <SortableTableHeader field="currentStock" align="right" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Estoque atual</SortableTableHeader>
            <SortableTableHeader field="minStock" align="right" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Estoque mínimo</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Alerta
            </th>
            <th v-if="canManage" data-actions class="print:hidden px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td :colspan="canManage ? 7 : 6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Carregando...
            </td>
          </tr>
          <tr v-else-if="products.length === 0">
            <td :colspan="canManage ? 7 : 6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum produto cadastrado.
            </td>
          </tr>
          <tr
            v-for="product in products"
            v-else
            :key="product.id"
            :class="canManage ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40' : ''"
            :title="canManage ? 'Duplo clique para ajustar estoque' : ''"
            @dblclick="canManage && openAdjustModal(product)"
          >
            <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="product.name" :max-length="45" />
            </td>
            <td class="max-w-64 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="product.category?.name" :max-length="40" />
            </td>
            <td class="max-w-40 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="product.unit?.name" :max-length="20" />
            </td>
            <td class="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {{ formatQuantity(product.currentStock) }}
            </td>
            <td class="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatQuantity(product.minStock) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge v-if="Number(product.currentStock) <= Number(product.minStock)" variant="warning">
                Estoque baixo
              </BaseBadge>
            </td>
            <td v-if="canManage" class="print:hidden px-4 py-3 text-right whitespace-nowrap" @dblclick.stop>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Ajustar estoque"
                @click="openAdjustModal(product)"
              >
                <Pencil :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-bind="paginationProps" />
    </div>

    <FilterModal
      :open="filterModalOpen"
      title="Filtrar estoque"
      @close="filterModalOpen = false"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseSelect v-model="draftFilters.categoryId" label="Categoria" :options="categoryFilterOptions" />
      <BaseToggle v-model="draftFilters.lowStockOnly" label="Somente estoque baixo" />
    </FilterModal>

    <BaseModal
      :open="adjustModalOpen"
      :title="`Ajustar estoque: ${adjustingProduct?.name ?? ''}`"
      @close="adjustModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="handleAdjustSubmit">
        <div
          class="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300"
        >
          <AlertTriangle :size="16" class="mt-0.5 shrink-0" />
          <p>
            Use só para corrigir divergência de contagem física. Entrada de mercadoria e perda têm telas próprias.
            O ajuste fica registrado no histórico de movimentações com o motivo informado.
          </p>
        </div>

        <p class="text-sm text-gray-500 dark:text-gray-400">
          Estoque atual:
          <span class="font-medium text-gray-700 dark:text-gray-300">
            {{ adjustingProduct ? Number(adjustingProduct.currentStock) : 0 }} {{ adjustingProduct?.unit?.abbreviation }}
          </span>
        </p>

        <BaseInput
          v-model="adjustForm.quantity"
          :decimal-places="3"
          :max="LIMITES_NUMERO.quantidade"
          label="Nova quantidade em estoque"
          :error="adjustFieldErrors.quantity"
          required
        />
        <BaseInput
          v-model="adjustForm.notes"
          label="Motivo do ajuste"
          placeholder="Ex.: contagem física apontou divergência"
          :maxlength="LIMITES_TEXTO.motivo"
          :error="adjustFieldErrors.notes"
          required
        />

        <p v-if="adjustErrorMessage" class="text-sm text-red-600 dark:text-red-400">{{ adjustErrorMessage }}</p>

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="adjustModalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="adjustSaving">{{ adjustSaving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="bulkAdjustModalOpen" title="Ajuste de estoque em lote" @close="bulkAdjustModalOpen = false">
      <form class="space-y-4" @submit.prevent="handleBulkAdjustSubmit">
        <div
          class="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300"
        >
          <AlertTriangle :size="16" class="mt-0.5 shrink-0" />
          <p>
            Use só para corrigir divergência de contagem física, como depois de um inventário completo. Entrada de
            mercadoria e perda têm telas próprias. Cada ajuste fica registrado no histórico com o motivo informado.
          </p>
        </div>

        <BaseInput
          v-model="bulkAdjustNotes"
          label="Motivo do ajuste"
          placeholder="Ex.: contagem física do inventário mensal"
          :maxlength="LIMITES_TEXTO.motivo"
          :error="bulkAdjustNotesError"
          required
        />

        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Produtos</h3>
            <button
              type="button"
              class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
              title="Adicionar produto"
              @click="addBulkAdjustItem"
            >
              <Plus :size="16" />
            </button>
          </div>

          <div class="space-y-3">
            <div
              v-for="(item, index) in bulkAdjustItems"
              :key="index"
              class="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-3 items-start border border-gray-100 dark:border-gray-700 rounded-lg p-3"
            >
              <BaseSelect
                :model-value="item.productId"
                label="Produto"
                :options="bulkAdjustProductOptions"
                :error="bulkAdjustItemErrors[index]?.productId"
                required
                @update:model-value="(value) => selectBulkAdjustProduct(index, value)"
              />
              <BaseInput
                v-model="item.quantity"
                :decimal-places="3"
                :max="LIMITES_NUMERO.quantidade"
                label="Nova quantidade"
                :error="bulkAdjustItemErrors[index]?.quantity"
                required
              />
              <div class="flex flex-col">
                <span class="block text-sm font-medium mb-1 invisible">Remover</span>
                <button
                  type="button"
                  class="inline-flex items-center justify-center h-9 w-9 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:pointer-events-none"
                  title="Remover produto"
                  :disabled="bulkAdjustItems.length === 1"
                  @click="removeBulkAdjustItem(index)"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <p v-if="bulkAdjustErrorMessage" class="text-sm text-red-600 dark:text-red-400">{{ bulkAdjustErrorMessage }}</p>

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="bulkAdjustModalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="bulkAdjustSaving">
            {{ bulkAdjustSaving ? 'Salvando...' : 'Salvar ajustes' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
