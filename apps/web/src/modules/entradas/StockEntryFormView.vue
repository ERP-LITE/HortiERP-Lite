<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FileUp, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import DateInput from '@/components/ui/DateInput.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { oldestEventDateIso, todayIso } from '@/lib/period'
import { getApiErrorMessage } from '@/services/api'
import { toastError, toastSuccess } from '@/lib/alerts'
import { listAllProducts } from '@/services/productsService'
import { createStockEntry, uploadStockEntryAttachment } from '@/services/stockEntriesService'
import type { Product } from '@/types'
import { formatFileSize } from '@/lib/format'
import { invoiceKeyError, invoiceSelectionError } from '@/lib/invoiceAttachments'
import { LIMITES_NUMERO, LIMITES_TEXTO } from '@/lib/limits'

interface ItemRow {
  productId: string
  quantity: string
  unitCost: string
}

const router = useRouter()
const products = ref<Product[]>([])
const { loading, errorMessage, withLoading } = useAsyncState()
const saving = ref(false)

const supplierName = ref('')
const entryDate = ref(todayIso())
const entryDateError = ref('')
const notes = ref('')
const invoiceNumber = ref('')
const invoiceSeries = ref('')
const invoiceAccessKey = ref('')
const invoiceIssuedAt = ref('')
const invoiceTotal = ref('')
const attachments = ref<File[]>([])
const attachmentsError = computed(() => invoiceSelectionError(attachments.value))
const invoiceErrors = ref<Record<string, string>>({})
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
  await withLoading(async () => {
    products.value = await listAllProducts({ active: true })
  })
}

function validate(): boolean {
  invoiceErrors.value = {}
  entryDateError.value = ''
  if (!entryDate.value) entryDateError.value = 'Informe a data da entrada'
  else if (entryDate.value > todayIso()) entryDateError.value = 'A data não pode ser futura'
  else if (entryDate.value < oldestEventDateIso()) entryDateError.value = 'A data é antiga demais'

  const chaveInvalida = invoiceKeyError(invoiceAccessKey.value)
  if (chaveInvalida) invoiceErrors.value.invoiceAccessKey = chaveInvalida
  itemErrors.value = items.value.map((item) => {
    const rowErrors: { productId?: string; quantity?: string } = {}
    if (!item.productId) rowErrors.productId = 'Selecione o produto'
    if (!item.quantity || Number(item.quantity) <= 0) rowErrors.quantity = 'Informe uma quantidade maior que zero'
    return rowErrors
  })

  return itemErrors.value.every((rowErrors) => Object.keys(rowErrors).length === 0) &&
    Object.keys(invoiceErrors.value).length === 0 &&
    !attachmentsError.value &&
    !entryDateError.value
}

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  attachments.value = Array.from(input.files ?? [])
  input.value = ''
}

async function handleSubmit() {
  errorMessage.value = ''
  if (!validate()) return

  saving.value = true

  try {
    const entry = await createStockEntry({
      supplierName: supplierName.value || undefined,
      entryDate: entryDate.value || undefined,
      notes: notes.value || undefined,
      invoiceNumber: invoiceNumber.value || undefined,
      invoiceSeries: invoiceSeries.value || undefined,
      invoiceAccessKey: invoiceAccessKey.value || undefined,
      invoiceIssuedAt: invoiceIssuedAt.value ? `${invoiceIssuedAt.value}T12:00:00` : undefined,
      invoiceTotal: invoiceTotal.value ? Number(invoiceTotal.value) : undefined,
      items: items.value.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitCost: item.unitCost ? Number(item.unitCost) : undefined,
      })),
    })
    try {
      for (const file of attachments.value) await uploadStockEntryAttachment(entry.id, file)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'A entrada foi registrada, mas um anexo não pôde ser enviado'))
      router.push({ name: 'entradas-detalhes', params: { id: entry.id } })
      return
    }
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
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DateInput
          v-model="entryDate"
          label="Data da entrada"
          :min="oldestEventDateIso()"
          :max="todayIso()"
          :error="entryDateError"
          required
        />
        <BaseInput v-model="supplierName" label="Fornecedor (opcional)" :maxlength="LIMITES_TEXTO.fornecedor" />
        <BaseInput v-model="notes" label="Observações (opcional)" :maxlength="LIMITES_TEXTO.observacoesEntrada" />
      </div>

      <section class="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div>
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Nota fiscal (opcional)</h2>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Identifique a NF-e e anexe até 3 arquivos XML, PDF ou imagem, com no máximo 10 MB cada.
          </p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BaseInput v-model="invoiceNumber" label="Número da nota" :maxlength="LIMITES_TEXTO.numeroNota" />
          <BaseInput v-model="invoiceSeries" label="Série" :maxlength="LIMITES_TEXTO.serieNota" />
          <DateInput v-model="invoiceIssuedAt" label="Data de emissão" />
          <BaseInput
            v-model="invoiceTotal"
            :decimal-places="2"
            :max="LIMITES_NUMERO.valorNota"
            label="Valor total (R$)"
          />
          <div class="sm:col-span-2">
            <BaseInput
              v-model="invoiceAccessKey"
              label="Chave de acesso (44 dígitos)"
              :maxlength="LIMITES_TEXTO.chaveNfe"
              :error="invoiceErrors.invoiceAccessKey"
            />
          </div>
        </div>
        <label
          class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-600 transition-colors hover:border-primary-500 hover:text-primary-600 dark:border-gray-600 dark:text-gray-300"
        >
          <FileUp :size="18" />
          <span>{{ attachments.length ? `${attachments.length} arquivo(s) selecionado(s)` : 'Selecionar anexos da nota' }}</span>
          <input class="sr-only" type="file" multiple accept=".xml,.pdf,.jpg,.jpeg,.png,.webp" @change="handleFiles" />
        </label>
        <p v-if="attachmentsError" class="text-xs text-red-600 dark:text-red-400">{{ attachmentsError }}</p>
        <ul v-if="attachments.length" class="space-y-1 text-xs text-gray-500 dark:text-gray-400">
          <li v-for="file in attachments" :key="`${file.name}-${file.size}`" class="break-all">
            {{ file.name }} · {{ formatFileSize(file.size) }}
          </li>
        </ul>
      </section>

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
              required
            />
            <BaseInput
              v-model="item.quantity"
              :decimal-places="3"
              :max="LIMITES_NUMERO.quantidade"
              label="Quantidade"
              :error="itemErrors[index]?.quantity"
              required
            />
            <BaseInput
              v-model="item.unitCost"
              :decimal-places="2"
              :max="LIMITES_NUMERO.valorUnitario"
              label="Custo unit. (opcional)"
            />
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
