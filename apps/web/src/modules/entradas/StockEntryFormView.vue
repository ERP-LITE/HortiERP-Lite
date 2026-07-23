<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { getApiErrorMessage } from '@/services/api'
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

const productOptions = computed(() => products.value.map((p) => ({ value: p.id, label: p.name })))

function addItem() {
  items.value.push({ productId: '', quantity: '', unitCost: '' })
}

function removeItem(index: number) {
  items.value.splice(index, 1)
}

async function loadProducts() {
  loading.value = true
  try {
    products.value = await listProducts()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  errorMessage.value = ''
  saving.value = true

  try {
    await createStockEntry({
      supplierName: supplierName.value || undefined,
      notes: notes.value || undefined,
      items: items.value
        .filter((item) => item.productId && item.quantity)
        .map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitCost: item.unitCost ? Number(item.unitCost) : undefined,
        })),
    })
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

    <p v-if="errorMessage" class="text-sm text-red-600 mb-4">{{ errorMessage }}</p>

    <form class="bg-white rounded-xl border border-gray-200 p-6 space-y-6" @submit.prevent="handleSubmit">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BaseInput v-model="supplierName" label="Fornecedor (opcional)" />
        <BaseInput v-model="notes" label="Observações (opcional)" />
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-gray-700">Itens</h3>
          <button type="button" class="text-sm text-primary-600 hover:underline" @click="addItem">
            + Adicionar item
          </button>
        </div>

        <div class="space-y-3">
          <div
            v-for="(item, index) in items"
            :key="index"
            class="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end border border-gray-100 rounded-lg p-3"
          >
            <BaseSelect v-model="item.productId" label="Produto" :options="productOptions" required />
            <BaseInput v-model="item.quantity" type="number" step="0.001" label="Quantidade" required />
            <BaseInput v-model="item.unitCost" type="number" step="0.01" label="Custo unit. (opcional)" />
            <button
              type="button"
              class="text-sm text-red-600 hover:underline mb-2"
              :disabled="items.length === 1"
              @click="removeItem(index)"
            >
              Remover
            </button>
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
