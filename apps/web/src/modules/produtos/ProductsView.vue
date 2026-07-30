<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import BulkSelectionBar from '@/components/ui/BulkSelectionBar.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import { listCategories } from '@/services/categoriesService'
import { listUnits } from '@/services/unitsService'
import { createProduct, deleteProduct, deleteProducts, listProducts, updateProduct } from '@/services/productsService'
import { useAuthStore } from '@/stores/auth'
import { usePagination } from '@/composables/usePagination'
import { useBulkSelection } from '@/composables/useBulkSelection'
import type { Category, Product, Unit } from '@/types'

const auth = useAuthStore()
const canManage = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'gerente')

const { page, pageSize, total, totalPages, applyMeta } = usePagination()

const products = ref<Product[]>([])
const { selectedIds, allVisibleSelected, toggleOne, toggleAllVisible, clearSelection } = useBulkSelection(() =>
  products.value.map(({ id }) => id),
)
const deletingSelected = ref(false)
const categories = ref<Category[]>([])
const units = ref<Unit[]>([])
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')
const emptyFilters = { categoryId: 'todas', active: 'todos' }
const filters = ref({ ...emptyFilters })
const draftFilters = ref({ ...emptyFilters })
const filterModalOpen = ref(false)
const activeFilterCount = computed(
  () => Number(filters.value.categoryId !== 'todas') + Number(filters.value.active !== 'todos'),
)
const statusFilterOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'true', label: 'Ativo' },
  { value: 'false', label: 'Inativo' },
]

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

const emptyForm = {
  categoryId: '',
  unitId: '',
  name: '',
  sku: '',
  barcode: '',
  costPrice: '',
  salePrice: '',
  minStock: '0',
  active: true,
}
const form = ref({ ...emptyForm })

const categoryOptions = computed(() => categories.value.map((c) => ({ value: c.id, label: c.name })))
const unitOptions = computed(() => units.value.map((u) => ({ value: u.id, label: `${u.name} (${u.abbreviation})` })))
const categoryFilterOptions = computed(() => [{ value: 'todas', label: 'Todas as categorias' }, ...categoryOptions.value])

function categoryName(id: string) {
  return categories.value.find((c) => c.id === id)?.name ?? '—'
}

function unitAbbreviation(id: string) {
  return units.value.find((u) => u.id === id)?.abbreviation ?? '—'
}

async function loadProducts() {
  loading.value = true
  try {
    const result = await listProducts({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      categoryId: filters.value.categoryId !== 'todas' ? filters.value.categoryId : undefined,
      active: filters.value.active === 'todos' ? undefined : filters.value.active === 'true',
    })
    products.value = result.data
    clearSelection()
    applyMeta(result)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function loadFormOptions() {
  try {
    const [categoriesResult, unitsResult] = await Promise.all([
      listCategories({ page: 1, pageSize: 100 }),
      listUnits({ page: 1, pageSize: 100 }),
    ])
    categories.value = categoriesResult.data
    units.value = unitsResult.data
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

async function loadAll() {
  await Promise.all([loadProducts(), loadFormOptions()])
}

function openFilterModal() {
  draftFilters.value = { ...filters.value }
  filterModalOpen.value = true
}

function applyFilters() {
  filters.value = { ...draftFilters.value }
  filterModalOpen.value = false
  page.value = 1
  loadProducts()
}

function clearFilters() {
  filters.value = { ...emptyFilters }
  draftFilters.value = { ...emptyFilters }
  filterModalOpen.value = false
  page.value = 1
  loadProducts()
}

function openCreateModal() {
  editingId.value = null
  form.value = { ...emptyForm }
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEditModal(product: Product) {
  editingId.value = product.id
  form.value = {
    categoryId: product.categoryId,
    unitId: product.unitId,
    name: product.name,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    costPrice: product.costPrice ?? '',
    salePrice: product.salePrice ?? '',
    minStock: product.minStock,
    active: product.active,
  }
  fieldErrors.value = {}
  modalOpen.value = true
}

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.value.name.trim()) fieldErrors.value.name = 'Informe o nome do produto'
  if (!form.value.categoryId) fieldErrors.value.categoryId = 'Selecione a categoria'
  if (!form.value.unitId) fieldErrors.value.unitId = 'Selecione a unidade'
  return Object.keys(fieldErrors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    const payload = {
      categoryId: form.value.categoryId,
      unitId: form.value.unitId,
      name: form.value.name,
      sku: form.value.sku || undefined,
      barcode: form.value.barcode || undefined,
      costPrice: form.value.costPrice ? Number(form.value.costPrice) : undefined,
      salePrice: form.value.salePrice ? Number(form.value.salePrice) : undefined,
      minStock: Number(form.value.minStock),
      active: form.value.active,
    }

    if (editingId.value) {
      await updateProduct(editingId.value, payload)
      toastSuccess('Produto atualizado com sucesso')
    } else {
      await createProduct(payload)
      toastSuccess('Produto criado com sucesso')
    }
    modalOpen.value = false
    await loadAll()
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível salvar o produto')
    fieldErrors.value = result.fieldErrors
    errorMessage.value = result.message
  } finally {
    saving.value = false
  }
}

async function handleDelete(product: Product) {
  const confirmed = await confirmDelete({
    title: `Excluir o produto "${product.name}"?`,
    text: 'Essa ação não pode ser desfeita.',
  })
  if (!confirmed) return

  try {
    await deleteProduct(product.id)
    await loadAll()
    toastSuccess('Produto excluído com sucesso')
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível excluir o produto'))
  }
}

async function handleBulkDelete() {
  const count = selectedIds.value.length
  const confirmed = await confirmDelete({
    title: `Excluir ${count} ${count === 1 ? 'produto selecionado' : 'produtos selecionados'}?`,
    text: 'Os registros serão excluídos logicamente e deixarão de aparecer no sistema.',
  })
  if (!confirmed) return

  deletingSelected.value = true
  try {
    const result = await deleteProducts(selectedIds.value)
    await loadProducts()
    toastSuccess(`${result.deleted} ${result.deleted === 1 ? 'produto excluído' : 'produtos excluídos'} com sucesso`)
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível excluir os produtos selecionados'))
  } finally {
    deletingSelected.value = false
  }
}

watch(search, () => {
  if (page.value !== 1) page.value = 1
  else loadProducts()
})
watch([page, pageSize], loadProducts)
onMounted(loadAll)
</script>

<template>
  <div>
    <PageHeader title="Produtos" subtitle="Cadastro de produtos do estoque">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por nome, SKU ou código de barras..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <BaseButton v-if="canManage" @click="openCreateModal"><Plus :size="16" /> Novo produto</BaseButton>
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
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th v-if="canManage" class="print:hidden w-12 px-4 py-3">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                :checked="allVisibleSelected"
                aria-label="Selecionar todos os produtos desta página"
                @change="toggleAllVisible"
              />
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Produto
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Categoria
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Estoque
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
            <th class="print:hidden px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td :colspan="canManage ? 6 : 5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="products.length === 0">
            <td :colspan="canManage ? 6 : 5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
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
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                :checked="selectedIds.includes(product.id)"
                :aria-label="`Selecionar produto ${product.name}`"
                @change="toggleOne(product.id)"
              />
            </td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
              {{ product.name }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ categoryName(product.categoryId) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {{ Number(product.currentStock) }} {{ unitAbbreviation(product.unitId) }}
              <BaseBadge v-if="Number(product.currentStock) <= Number(product.minStock)" variant="warning" class="ml-1">
                baixo
              </BaseBadge>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge :variant="product.active ? 'success' : 'neutral'">
                {{ product.active ? 'Ativo' : 'Inativo' }}
              </BaseBadge>
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
            <td v-else class="print:hidden px-4 py-3" />
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

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar produto' : 'Novo produto'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="form.name" label="Nome" :error="fieldErrors.name" />

        <div class="grid grid-cols-2 gap-4">
          <BaseSelect
            v-model="form.categoryId"
            label="Categoria"
            :options="categoryOptions"
            :error="fieldErrors.categoryId"
          />
          <BaseSelect
            v-model="form.unitId"
            label="Unidade"
            :options="unitOptions"
            :error="fieldErrors.unitId"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <BaseInput v-model="form.sku" label="SKU (opcional)" :error="fieldErrors.sku" />
          <BaseInput v-model="form.barcode" label="Código de barras (opcional)" />
        </div>

        <div class="grid grid-cols-3 gap-4">
          <BaseInput v-model="form.costPrice" type="number" step="0.01" label="Custo (R$)" />
          <BaseInput v-model="form.salePrice" type="number" step="0.01" label="Venda (R$)" />
          <BaseInput v-model="form.minStock" type="number" step="0.001" label="Estoque mínimo" required />
        </div>

        <BaseToggle v-model="form.active" label="Produto ativo" />

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="filterModalOpen" title="Filtrar produtos" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <BaseSelect v-model="draftFilters.categoryId" label="Categoria" :options="categoryFilterOptions" />
        <BaseSelect v-model="draftFilters.active" label="Status" :options="statusFilterOptions" />

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
