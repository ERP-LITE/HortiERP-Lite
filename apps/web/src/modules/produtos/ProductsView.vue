<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { getApiErrorMessage } from '@/services/api'
import { listCategories } from '@/services/categoriesService'
import { listUnits } from '@/services/unitsService'
import { createProduct, deleteProduct, listProducts, updateProduct } from '@/services/productsService'
import type { Category, Product, Unit } from '@/types'

const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const units = ref<Unit[]>([])
const loading = ref(true)
const errorMessage = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

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

function categoryName(id: string) {
  return categories.value.find((c) => c.id === id)?.name ?? '—'
}

function unitAbbreviation(id: string) {
  return units.value.find((u) => u.id === id)?.abbreviation ?? '—'
}

async function loadAll() {
  loading.value = true
  try {
    const [productsData, categoriesData, unitsData] = await Promise.all([
      listProducts(),
      listCategories(),
      listUnits(),
    ])
    products.value = productsData
    categories.value = categoriesData
    units.value = unitsData
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  editingId.value = null
  form.value = { ...emptyForm }
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
  modalOpen.value = true
}

async function handleSubmit() {
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
    } else {
      await createProduct(payload)
    }
    modalOpen.value = false
    await loadAll()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível salvar o produto')
  } finally {
    saving.value = false
  }
}

async function handleDelete(product: Product) {
  if (!confirm(`Excluir o produto "${product.name}"?`)) return

  try {
    await deleteProduct(product.id)
    await loadAll()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível excluir o produto')
  }
}

onMounted(loadAll)
</script>

<template>
  <div>
    <PageHeader title="Produtos" subtitle="Cadastro de produtos do estoque">
      <template #actions>
        <BaseButton @click="openCreateModal"><Plus :size="16" /> Novo produto</BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
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
            <td class="px-4 py-3 text-right space-x-3 whitespace-nowrap">
              <button
                class="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline dark:text-primary-400"
                @click="openEditModal(product)"
              >
                <Pencil :size="14" /> Editar
              </button>
              <button
                class="inline-flex items-center gap-1 text-sm text-red-600 hover:underline dark:text-red-400"
                @click="handleDelete(product)"
              >
                <Trash2 :size="14" /> Excluir
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar produto' : 'Novo produto'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="form.name" label="Nome" required />

        <div class="grid grid-cols-2 gap-4">
          <BaseSelect v-model="form.categoryId" label="Categoria" :options="categoryOptions" required />
          <BaseSelect v-model="form.unitId" label="Unidade" :options="unitOptions" required />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <BaseInput v-model="form.sku" label="SKU (opcional)" />
          <BaseInput v-model="form.barcode" label="Código de barras (opcional)" />
        </div>

        <div class="grid grid-cols-3 gap-4">
          <BaseInput v-model="form.costPrice" type="number" step="0.01" label="Custo (R$)" />
          <BaseInput v-model="form.salePrice" type="number" step="0.01" label="Venda (R$)" />
          <BaseInput v-model="form.minStock" type="number" step="0.001" label="Estoque mínimo" required />
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            v-model="form.active"
            type="checkbox"
            class="rounded border-gray-300 text-primary-600 dark:border-gray-600 dark:bg-gray-800"
          />
          Produto ativo
        </label>

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
