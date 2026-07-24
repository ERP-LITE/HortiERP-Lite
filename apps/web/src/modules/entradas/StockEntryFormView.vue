<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { getApiErrorMessage } from '@/services/api'
import { toastSuccess } from '@/lib/alerts'
import { listProducts } from '@/services/productsService'
import { createStockEntry } from '@/services/stockEntriesService'
import type { Product } from '@/types'

interface ItemRow {
  productId: string
  quantity: string
  unitCost: string
}

const router = useRouter()
const products = ref<Product[]>([])
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')

const supplierName = ref('')
const notes = ref('')
const items = ref<ItemRow[]>([{ productId: '', quantity: '', unitCost: '' }])
const itemErrors = ref<{ productId?: string; quantity?: string }[]>([])

const productOptions = computed(() => products.value.map((p) => ({ value: p.id, label: p.name })))

function addItem() {
  items.value.push({ productId: '', quantity: '', unitCost: '' })
  itemErrors.value = []
}

function removeItem(index: number) {
  items.value.splice(index, 1)
  itemErrors.value = []
}

async function loadProducts() {
  loading.value = true
  try {
    products.value = (await listProducts({ page: 1, pageSize: 100 })).data
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function validate(): boolean {
  itemErrors.value = items.value.map((item) => {
    const rowErrors: { productId?: string; quantity?: string } = {}
    if (!item.productId) rowErrors.productId = 'Selecione o produto'
    if (!item.quantity || Number(item.quantity) <= 0) rowErrors.quantity = 'Informe uma quantidade maior que zero'
    return rowErrors
  })

  return itemErrors.value.every((rowErrors) => Object.keys(rowErrors).length === 0)
}

async function handleSubmit() {
  errorMessage.value = ''
  if (!validate()) return

  saving.value = true

  try {
    await createStockEntry({
      supplierName: supplierName.value || undefined,
      notes: notes.value || undefined,
      items: items.value.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitCost: item.unitCost ? Number(item.unitCost) : undefined,
      })),
    })
    toastSuccess('Entrada registrada com sucesso')
    router.push({ name: 'entradas' })
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível registrar a entrada')
  } finally {
    saving.value = false
  }
}

onMounted(loadProducts)
</script>

<template>
  <div>
    <PageHeader title="Nova entrada de mercadoria" subtitle="Registre o recebimento de produtos no estoque" />

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <form
      class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6"
      @submit.prevent="handleSubmit"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BaseInput v-model="supplierName" label="Fornecedor (opcional)" />
        <BaseInput v-model="notes" label="Observações (opcional)" />
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Itens</h3>
          <button
            type="button"
            class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
            title="Adicionar item"
            @click="addItem"
          >
            <Plus :size="16" />
          </button>
        </div>

        <div class="space-y-3">
          <div
            v-for="(item, index) in items"
            :key="index"
            class="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-start border border-gray-100 dark:border-gray-700 rounded-lg p-3"
          >
            <BaseSelect
              v-model="item.productId"
              label="Produto"
              :options="productOptions"
              :error="itemErrors[index]?.productId"
            />
            <BaseInput
              v-model="item.quantity"
              type="number"
              step="0.001"
              label="Quantidade"
              :error="itemErrors[index]?.quantity"
            />
            <BaseInput v-model="item.unitCost" type="number" step="0.01" label="Custo unit. (opcional)" />
            <div class="flex flex-col">
              <span class="block text-sm font-medium mb-1 invisible">Remover</span>
              <button
                type="button"
                class="inline-flex items-center justify-center h-9 w-9 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:pointer-events-none"
                title="Remover item"
                :disabled="items.length === 1"
                @click="removeItem(index)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <BaseButton variant="secondary" type="button" @click="router.push({ name: 'entradas' })">
          Cancelar
        </BaseButton>
        <BaseButton type="submit" :disabled="saving || loading">
          {{ saving ? 'Salvando...' : 'Registrar entrada' }}
        </BaseButton>
      </div>
    </form>
  </div>
</template>
