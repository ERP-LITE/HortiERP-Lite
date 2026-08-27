<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2, Upload } from '@lucide/vue'
import ProductImportModal from './ProductImportModal.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import FilterModal from '@/components/ui/FilterModal.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import ExportCsvButton from '@/components/ui/ExportCsvButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import BulkSelectionBar from '@/components/ui/BulkSelectionBar.vue'
import TableCheckbox from '@/components/ui/TableCheckbox.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { listAllCategories } from '@/services/categoriesService'
import { listAllUnits } from '@/services/unitsService'
import { createProduct, deleteProduct, deleteProducts, listAllProducts, listProducts, updateProduct } from '@/services/productsService'
import { csvNumber } from '@/lib/csv'
import { useAsyncState } from '@/composables/useAsyncState'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { useCrudModal } from '@/composables/useCrudModal'
import { useFilterModal } from '@/composables/useFilterModal'
import { usePagination } from '@/composables/usePagination'
import { usePermissions } from '@/composables/usePermissions'
import { useRecordDeletion } from '@/composables/useRecordDeletion'
import { useTableSort } from '@/composables/useTableSort'
import { LIMITES_NUMERO, LIMITES_TEXTO } from '@/lib/limits'
import type { Category, Product, Unit } from '@/types'
import { formatQuantity } from '@/lib/format'
import { statusFilterOptionsFor, statusLabel } from '@/lib/status'

const { canManage } = usePermissions()

const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadProducts), 'name')

const products = ref<Product[]>([])
const { selectedIds, allVisibleSelected, toggleOne, toggleAllVisible, clearSelection } = useBulkSelection(() =>
  products.value.map(({ id }) => id),
)
const categories = ref<Category[]>([])
const units = ref<Unit[]>([])
const { loading, errorMessage, withLoading, captureError } = useAsyncState()

const search = ref('')
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  () => ({ categoryId: 'todas', unitId: 'todas', active: 'todos' }),
  () => reload(loadProducts),
)
const activeFilterCount = computed(
  () =>
    Number(filters.value.categoryId !== 'todas') +
    Number(filters.value.unitId !== 'todas') +
    Number(filters.value.active !== 'todos'),
)
const statusFilterOptions = statusFilterOptionsFor()

const importModalOpen = ref(false)

async function loadProducts() {
  await withLoading(async () => {
    const result = await listProducts({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      categoryId: filters.value.categoryId !== 'todas' ? filters.value.categoryId : undefined,
      unitId: filters.value.unitId !== 'todas' ? filters.value.unitId : undefined,
      active: filters.value.active === 'todos' ? undefined : filters.value.active === 'true',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    products.value = result.data
    clearSelection()
    applyMeta(result)
  })
}

async function loadFormOptions() {
  await captureError(async () => {
    const [categoryOptions, unitOptions] = await Promise.all([listAllCategories(), listAllUnits()])
    categories.value = categoryOptions
    units.value = unitOptions
  })
}

async function exportCsv() {
  const all = await listAllProducts({
    search: search.value || undefined,
    categoryId: filters.value.categoryId !== 'todas' ? filters.value.categoryId : undefined,
    active: filters.value.active !== 'todos' ? filters.value.active === 'true' : undefined,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  })
  const categoryById = new Map(categories.value.map((item) => [item.id, item.name]))
  const unitById = new Map(units.value.map((item) => [item.id, item.name]))

  return {
    headers: ['Nome', 'Categoria', 'Unidade', 'Codigo', 'Codigo de barras', 'Custo', 'Preco de venda', 'Estoque atual', 'Estoque minimo', 'Situacao'],
    rows: all.map((item) => [
      item.name,
      categoryById.get(item.categoryId) ?? '',
      unitById.get(item.unitId) ?? '',
      item.sku ?? '',
      item.barcode ?? '',
      csvNumber(item.costPrice),
      csvNumber(item.salePrice),
      csvNumber(item.currentStock, 3),
      csvNumber(item.minStock, 3),
      statusLabel(item.active),
    ]),
  }
}

async function loadAll() {
  await Promise.all([loadProducts(), loadFormOptions()])
}

interface ProductForm {
  categoryId: string
  unitId: string
  name: string
  sku: string
  barcode: string
  costPrice: string
  salePrice: string
  minStock: string
  active: boolean
}

function toPayload(values: ProductForm) {
  return {
    categoryId: values.categoryId,
    unitId: values.unitId,
    name: values.name,
    sku: values.sku || null,
    barcode: values.barcode || null,
    costPrice: values.costPrice ? Number(values.costPrice) : null,
    salePrice: values.salePrice ? Number(values.salePrice) : null,
    minStock: Number(values.minStock),
    active: values.active,
  }
}

const { modalOpen, editingId, saving, form, fieldErrors, openCreateModal, openEditModal, handleSubmit } = useCrudModal<
  ProductForm,
  Product
>({
  emptyForm: () => ({
    categoryId: '',
    unitId: '',
    name: '',
    sku: '',
    barcode: '',
    costPrice: '',
    salePrice: '',
    minStock: '0',
    active: true,
  }),
  toForm: (product) => ({
    categoryId: product.categoryId,
    unitId: product.unitId,
    name: product.name,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    costPrice: product.costPrice ?? '',
    salePrice: product.salePrice ?? '',
    minStock: product.minStock,
    active: product.active,
  }),
  create: (values) => createProduct(toPayload(values)),
  update: (id, values) => updateProduct(id, toPayload(values)),
  reload: loadAll,
  createdMessage: 'Produto criado com sucesso',
  updatedMessage: 'Produto atualizado com sucesso',
  saveErrorMessage: 'Não foi possível salvar o produto',
  validate,
})

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.value.name.trim()) fieldErrors.value.name = 'Informe o nome do produto'
  if (!form.value.categoryId) fieldErrors.value.categoryId = 'Selecione a categoria'
  if (!form.value.unitId) fieldErrors.value.unitId = 'Selecione a unidade'
  if (form.value.minStock === '') fieldErrors.value.minStock = 'Informe o estoque mínimo'
  return Object.keys(fieldErrors.value).length === 0
}

const categoryOptions = computed(() =>
  categories.value
    .filter((c) => c.active || c.id === form.value.categoryId)
    .map((c) => ({ value: c.id, label: c.active ? c.name : `${c.name} (inativa)` })),
)
const unitOptions = computed(() =>
  units.value
    .filter((u) => u.active || u.id === form.value.unitId)
    .map((u) => ({
      value: u.id,
      label: u.active ? `${u.name} (${u.abbreviation})` : `${u.name} (${u.abbreviation}) inativa`,
    })),
)
const categoryFilterOptions = computed(() => [
  { value: 'todas', label: 'Todas as categorias' },
  ...categories.value.map((c) => ({ value: c.id, label: c.name })),
])
const unitFilterOptions = computed(() => [
  { value: 'todas', label: 'Todas as unidades' },
  ...units.value.map((u) => ({ value: u.id, label: `${u.name} (${u.abbreviation})` })),
])

function categoryName(id: string) {
  return categories.value.find((c) => c.id === id)?.name ?? '—'
}

function unitAbbreviation(id: string) {
  return units.value.find((u) => u.id === id)?.abbreviation ?? '—'
}

const { deletingSelected, handleDelete, handleBulkDelete } = useRecordDeletion<Product>({
  singular: 'produto',
  plural: 'produtos',
  remove: deleteProduct,
  removeMany: deleteProducts,
  selectedIds,
  reload: loadProducts,
})

watchSearch(search, loadProducts)
onMounted(loadAll)
</script>

<template>
  <div>
    <PageHeader title="Produtos" subtitle="Cadastro de produtos do estoque">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por nome, SKU ou código de barras..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <ExportCsvButton file-name="produtos" :load="exportCsv" />
        <BaseButton
          v-if="canManage"
          variant="secondary"
          class="!px-2.5 sm:!px-4"
          title="Importar planilha"
          aria-label="Importar planilha"
          @click="importModalOpen = true"
        >
          <Upload :size="16" /> <span class="hidden sm:inline">Importar</span>
        </BaseButton>
        <BaseButton v-if="canManage" class="!px-2.5 sm:!px-4" title="Novo produto" aria-label="Novo produto" @click="openCreateModal">
          <Plus :size="16" /> <span class="hidden sm:inline">Novo produto</span>
        </BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <BulkSelectionBar
      v-if="canManage"
      :count="selectedIds.length"
      :deleting="deletingSelected"
      @clear="clearSelection"
      @delete="handleBulkDelete"
    />

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th v-if="canManage" class="print:hidden w-12 px-4 py-3">
              <TableCheckbox
                :checked="allVisibleSelected"
                label="Selecionar todos os produtos desta página"
                @toggle="toggleAllVisible"
              />
            </th>
            <SortableTableHeader field="name" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Produto</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Categoria
            </th>
            <SortableTableHeader field="currentStock" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Estoque</SortableTableHeader>
            <SortableTableHeader field="active" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Situação</SortableTableHeader>
            <th v-if="canManage" data-actions class="print:hidden px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td :colspan="canManage ? 6 : 4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="products.length === 0">
            <td :colspan="canManage ? 6 : 4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum produto cadastrado.
            </td>
          </tr>
          <tr
            v-for="product in products"
            v-else
            :key="product.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-700/40"
            :class="canManage ? 'cursor-pointer' : ''"
            :title="canManage ? 'Duplo clique para editar' : ''"
            @dblclick="canManage && openEditModal(product)"
          >
            <td v-if="canManage" class="print:hidden px-4 py-3" @dblclick.stop @click.stop>
              <TableCheckbox
                :checked="selectedIds.includes(product.id)"
                :label="`Selecionar produto ${product.name}`"
                @toggle="toggleOne(product.id)"
              />
            </td>
            <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="product.name" :max-length="45" />
            </td>
            <td class="max-w-64 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="categoryName(product.categoryId)" :max-length="40" />
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {{ formatQuantity(product.currentStock) }} {{ unitAbbreviation(product.unitId) }}
              <BaseBadge v-if="Number(product.currentStock) <= Number(product.minStock)" variant="warning" class="ml-1">
                baixo
              </BaseBadge>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <StatusBadge :active="product.active" />
            </td>
            <td v-if="canManage" class="print:hidden px-4 py-3 text-right space-x-1 whitespace-nowrap" @dblclick.stop>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Editar"
                @click="openEditModal(product)"
              >
                <Pencil :size="16" />
              </button>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                title="Excluir"
                @click="handleDelete(product)"
              >
                <Trash2 :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-bind="paginationProps" />
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar produto' : 'Novo produto'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput
          v-model="form.name"
          label="Nome"
          :maxlength="LIMITES_TEXTO.nome"
          :error="fieldErrors.name"
          required
        />

        <div class="grid grid-cols-2 gap-4">
          <BaseSelect
            v-model="form.categoryId"
            label="Categoria"
            :options="categoryOptions"
            :error="fieldErrors.categoryId"
            required
          />
          <BaseSelect
            v-model="form.unitId"
            label="Unidade"
            :options="unitOptions"
            :error="fieldErrors.unitId"
            required
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <BaseInput
            v-model="form.sku"
            label="SKU (opcional)"
            :maxlength="LIMITES_TEXTO.sku"
            :error="fieldErrors.sku"
          />
          <BaseInput
            v-model="form.barcode"
            label="Código de barras (opcional)"
            :maxlength="LIMITES_TEXTO.codigoBarras"
            :error="fieldErrors.barcode"
          />
        </div>

        <div class="grid grid-cols-3 gap-4">
          <BaseInput
            v-model="form.costPrice"
            :decimal-places="2"
            :max="LIMITES_NUMERO.valorUnitario"
            label="Custo (R$)"
            :error="fieldErrors.costPrice"
          />
          <BaseInput
            v-model="form.salePrice"
            :decimal-places="2"
            :max="LIMITES_NUMERO.valorUnitario"
            label="Venda (R$)"
            :error="fieldErrors.salePrice"
          />
          <BaseInput
            v-model="form.minStock"
            :decimal-places="3"
            :max="LIMITES_NUMERO.quantidade"
            label="Estoque mínimo"
            :error="fieldErrors.minStock"
            required
          />
        </div>

        <BaseToggle v-model="form.active" label="Produto ativo" />

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <FilterModal
      :open="filterModalOpen"
      title="Filtrar produtos"
      @close="filterModalOpen = false"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseSelect v-model="draftFilters.categoryId" label="Categoria" :options="categoryFilterOptions" />
      <BaseSelect v-model="draftFilters.unitId" label="Unidade" :options="unitFilterOptions" />
      <BaseSelect v-model="draftFilters.active" label="Situação" :options="statusFilterOptions" />
    </FilterModal>

    <ProductImportModal :open="importModalOpen" @close="importModalOpen = false" @imported="loadAll" />
  </div>
</template>
