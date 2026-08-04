<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { AlertTriangle, History, ListChecks, Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { toastSuccess } from '@/lib/alerts'
import { adjustStock, listCurrentStock } from '@/services/stockService'
import { listAllCategories } from '@/services/categoriesService'
import { listAllProducts } from '@/services/productsService'
import { useAuthStore } from '@/stores/auth'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import type { Category, Product, ProductWithRelations } from '@/types'

const auth = useAuthStore()
const canManage = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'gerente')

const { page, pageSize, total, totalPages, applyMeta } = usePagination()

const products = ref<ProductWithRelations[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  () => ({ categoryId: 'todas', lowStockOnly: false }),
  () => {
    page.value = 1
    loadStock()
  },
)
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
    categories.value = await listAllCategories()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
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
            <th v-if="canManage" class="print:hidden px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td :colspan="canManage ? 6 : 5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Carregando...
            </td>
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
            :class="canManage ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40' : ''"
            :title="canManage ? 'Duplo clique para ajustar estoque' : ''"
            @dblclick="canManage && openAdjustModal(product)"
          >
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

    <BaseModal
      :open="adjustModalOpen"
      :title="`Ajustar estoque — ${adjustingProduct?.name ?? ''}`"
      @close="adjustModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="handleAdjustSubmit">
        <div
          class="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300"
        >
          <AlertTriangle :size="16" class="mt-0.5 shrink-0" />
          <p>
            Use isso só pra corrigir divergências de contagem física (inventário). Entradas de mercadoria e perdas
            devem continuar sendo lançadas pelas telas próprias — o ajuste manual fica registrado no histórico de
            movimentações com o motivo informado, mas não passa pelas validações de fornecedor ou motivo de perda.
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
          label="Nova quantidade em estoque"
          :error="adjustFieldErrors.quantity"
        />
        <BaseInput
          v-model="adjustForm.notes"
          label="Motivo do ajuste"
          placeholder="Ex.: contagem física apontou divergência"
          :error="adjustFieldErrors.notes"
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
            Use isso só pra corrigir divergências de contagem física (inventário), como depois de uma contagem
            completa. Entradas de mercadoria e perdas devem continuar sendo lançadas pelas telas próprias — cada
            ajuste fica registrado no histórico de movimentações com o motivo informado.
          </p>
        </div>

        <BaseInput
          v-model="bulkAdjustNotes"
          label="Motivo do ajuste"
          placeholder="Ex.: contagem física do inventário mensal"
          :error="bulkAdjustNotesError"
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
                @update:model-value="(value) => selectBulkAdjustProduct(index, value)"
              />
              <BaseInput
                v-model="item.quantity"
                :decimal-places="3"
                label="Nova quantidade"
                :error="bulkAdjustItemErrors[index]?.quantity"
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
