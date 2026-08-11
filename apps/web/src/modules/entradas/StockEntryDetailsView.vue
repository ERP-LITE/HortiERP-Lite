<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, Eye, File, FileUp, Pencil, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import DateInput from '@/components/ui/DateInput.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import { getApiErrorMessage } from '@/services/api'
import {
  getStockEntry,
  getStockEntryAttachmentBlob,
  deleteStockEntryAttachment,
  updateStockEntryDetails,
  uploadStockEntryAttachment,
} from '@/services/stockEntriesService'
import type { StockEntry, StockEntryAttachment } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useLocalTableSort } from '@/composables/useTableSort'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canDeleteAttachments = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'gerente')
const canEditDetails = canDeleteAttachments
const entry = ref<StockEntry | null>(null)
const entryItems = computed(() => entry.value?.items ?? [])
const itemSort = useLocalTableSort(entryItems, {
  product: (item) => item.product.name,
  quantity: (item) => Number(item.quantity),
  unitCost: (item) => Number(item.unitCost ?? 0),
}, 'product')
const loading = ref(true)
const uploading = ref(false)
const errorMessage = ref('')
const previewUrl = ref('')
const previewAttachment = ref<StockEntryAttachment | null>(null)
const previewLoading = ref(false)
const deletingAttachmentId = ref('')
const editOpen = ref(false)
const editing = ref(false)
const editError = ref('')
const editForm = ref({
  supplierName: '',
  notes: '',
  invoiceNumber: '',
  invoiceSeries: '',
  invoiceAccessKey: '',
  invoiceIssuedAt: '',
  invoiceTotal: '',
})
const entryId = computed(() => String(route.params.id))

function formatFileSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${Math.ceil(size / 1024)} KB`
}

function isPreviewable(attachment: StockEntryAttachment) {
  return attachment.mimeType === 'application/pdf' || attachment.mimeType.startsWith('image/')
}

async function loadEntry() {
  loading.value = true
  errorMessage.value = ''
  try {
    entry.value = await getStockEntry(entryId.value)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível carregar a entrada')
  } finally {
    loading.value = false
  }
}

function openEdit() {
  if (!entry.value) return
  editForm.value = {
    supplierName: entry.value.supplierName ?? '',
    notes: entry.value.notes ?? '',
    invoiceNumber: entry.value.invoiceNumber ?? '',
    invoiceSeries: entry.value.invoiceSeries ?? '',
    invoiceAccessKey: entry.value.invoiceAccessKey ?? '',
    invoiceIssuedAt: entry.value.invoiceIssuedAt?.slice(0, 10) ?? '',
    invoiceTotal: entry.value.invoiceTotal ?? '',
  }
  editError.value = ''
  editOpen.value = true
}

async function handleEdit() {
  if (editForm.value.invoiceAccessKey && !/^\d{44}$/.test(editForm.value.invoiceAccessKey)) {
    editError.value = 'A chave da NF-e deve ter 44 dígitos'
    return
  }
  editing.value = true
  editError.value = ''
  try {
    entry.value = await updateStockEntryDetails(entryId.value, {
      supplierName: editForm.value.supplierName || null,
      notes: editForm.value.notes || null,
      invoiceNumber: editForm.value.invoiceNumber || null,
      invoiceSeries: editForm.value.invoiceSeries || null,
      invoiceAccessKey: editForm.value.invoiceAccessKey || null,
      invoiceIssuedAt: editForm.value.invoiceIssuedAt ? `${editForm.value.invoiceIssuedAt}T12:00:00` : null,
      invoiceTotal: editForm.value.invoiceTotal ? Number(editForm.value.invoiceTotal) : null,
    })
    editOpen.value = false
    toastSuccess('Dados da entrada atualizados')
  } catch (error) {
    editError.value = getApiErrorMessage(error, 'Não foi possível atualizar os dados da entrada')
  } finally {
    editing.value = false
  }
}

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewAttachment.value = null
}

async function openPreview(attachment: StockEntryAttachment) {
  clearPreview()
  previewAttachment.value = attachment
  previewLoading.value = true
  try {
    const blob = await getStockEntryAttachmentBlob(entryId.value, attachment.id, true)
    previewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível visualizar o anexo')
    previewAttachment.value = null
  } finally {
    previewLoading.value = false
  }
}

async function downloadAttachment(attachment: StockEntryAttachment) {
  try {
    const blob = await getStockEntryAttachmentBlob(entryId.value, attachment.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = attachment.originalName
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível baixar o anexo')
  }
}

async function handleDeleteAttachment(attachment: StockEntryAttachment) {
  const confirmed = await confirmDelete({
    title: `Excluir o anexo "${attachment.originalName}"?`,
    text: 'O arquivo será removido definitivamente desta entrada.',
  })
  if (!confirmed) return

  deletingAttachmentId.value = attachment.id
  errorMessage.value = ''
  try {
    if (previewAttachment.value?.id === attachment.id) clearPreview()
    await deleteStockEntryAttachment(entryId.value, attachment.id)
    await loadEntry()
    toastSuccess('Anexo excluído com sucesso')
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível excluir o anexo'))
  } finally {
    deletingAttachmentId.value = ''
  }
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  if ((entry.value?.attachments.length ?? 0) + files.length > 3) {
    errorMessage.value = 'Cada entrada aceita no máximo 3 anexos'
    return
  }
  if (files.some((file) => file.size > 10 * 1024 * 1024)) {
    errorMessage.value = 'Cada arquivo pode ter até 10 MB'
    return
  }

  uploading.value = true
  errorMessage.value = ''
  try {
    for (const file of files) await uploadStockEntryAttachment(entryId.value, file)
    await loadEntry()
    toastSuccess('Anexo enviado com sucesso')
  } catch (error) {
    const message = getApiErrorMessage(error, 'Não foi possível enviar o anexo')
    await loadEntry()
    errorMessage.value = message
  } finally {
    uploading.value = false
  }
}

onMounted(loadEntry)
onBeforeUnmount(clearPreview)
</script>

<template>
  <div>
    <PageHeader title="Detalhes da entrada" subtitle="Mercadoria recebida e documentação fiscal">
      <template #actions>
        <BaseButton v-if="canEditDetails" variant="secondary" @click="openEdit">
          <Pencil :size="16" /> Editar
        </BaseButton>
        <BaseButton variant="secondary" @click="router.push({ name: 'entradas' })">
          <ArrowLeft :size="16" /> Voltar
        </BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="mb-4 break-all text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>
    <p v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>

    <div v-else-if="entry" class="space-y-6">
      <section class="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-4">
        <div><p class="text-xs text-gray-500 dark:text-gray-400">Data da entrada</p><p class="mt-1 font-medium dark:text-gray-100">{{ formatDate(entry.entryDate) }}</p></div>
        <div><p class="text-xs text-gray-500 dark:text-gray-400">Fornecedor</p><ExpandableText :text="entry.supplierName" class="mt-1 font-medium dark:text-gray-100" /></div>
        <div><p class="text-xs text-gray-500 dark:text-gray-400">Recebido por</p><ExpandableText :text="entry.createdByUser?.name" empty-text="Usuário não identificado" class="mt-1 font-medium dark:text-gray-100" /></div>
        <div><p class="text-xs text-gray-500 dark:text-gray-400">Registrado em</p><p class="mt-1 font-medium dark:text-gray-100">{{ formatDateTime(entry.createdAt) }}</p></div>
        <div v-if="entry.notes" class="sm:col-span-2 lg:col-span-4"><p class="text-xs text-gray-500 dark:text-gray-400">Observações</p><p class="mt-1 whitespace-pre-wrap break-all dark:text-gray-100">{{ entry.notes }}</p></div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700"><h2 class="font-semibold text-gray-800 dark:text-gray-100">Itens recebidos</h2></div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/60"><tr><SortableTableHeader field="product" :active-field="itemSort.sortBy.value" :order="itemSort.sortOrder.value" @sort="itemSort.toggleSort">Produto</SortableTableHeader><SortableTableHeader field="quantity" :active-field="itemSort.sortBy.value" :order="itemSort.sortOrder.value" align="right" @sort="itemSort.toggleSort">Quantidade</SortableTableHeader><SortableTableHeader field="unitCost" :active-field="itemSort.sortBy.value" :order="itemSort.sortOrder.value" align="right" @sort="itemSort.toggleSort">Custo unitário</SortableTableHeader></tr></thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700"><tr v-for="item in itemSort.sortedItems.value" :key="item.id"><td class="max-w-80 px-4 py-3 text-sm font-medium dark:text-gray-100"><ExpandableText :text="item.product.name" /></td><td class="px-4 py-3 text-right text-sm whitespace-nowrap dark:text-gray-300">{{ Number(item.quantity) }} {{ item.product.unit.abbreviation }}</td><td class="px-4 py-3 text-right text-sm dark:text-gray-300">{{ formatCurrency(item.unitCost, '—') }}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div><h2 class="font-semibold text-gray-800 dark:text-gray-100">Nota fiscal</h2><p class="text-xs text-gray-500 dark:text-gray-400">Dados e arquivos privados vinculados à entrada</p></div>
          <label v-if="entry.attachments.length < 3" class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            <FileUp :size="16" /> {{ uploading ? 'Enviando...' : 'Adicionar anexo' }}
            <input class="sr-only" type="file" multiple :disabled="uploading" accept=".xml,.pdf,.jpg,.jpeg,.png,.webp" @change="handleUpload" />
          </label>
        </div>
        <div class="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div><p class="text-xs text-gray-500 dark:text-gray-400">Número</p><p class="mt-1 break-all font-medium dark:text-gray-100">{{ entry.invoiceNumber || '—' }}</p></div>
          <div><p class="text-xs text-gray-500 dark:text-gray-400">Série</p><p class="mt-1 break-all font-medium dark:text-gray-100">{{ entry.invoiceSeries || '—' }}</p></div>
          <div><p class="text-xs text-gray-500 dark:text-gray-400">Emissão</p><p class="mt-1 font-medium dark:text-gray-100">{{ entry.invoiceIssuedAt ? formatDate(entry.invoiceIssuedAt) : '—' }}</p></div>
          <div><p class="text-xs text-gray-500 dark:text-gray-400">Valor total</p><p class="mt-1 font-medium dark:text-gray-100">{{ formatCurrency(entry.invoiceTotal, '—') }}</p></div>
          <div class="sm:col-span-2 lg:col-span-5"><p class="text-xs text-gray-500 dark:text-gray-400">Chave de acesso</p><p class="mt-1 break-all font-mono text-xs dark:text-gray-100">{{ entry.invoiceAccessKey || '—' }}</p></div>
        </div>
        <div class="border-t border-gray-200 p-5 dark:border-gray-700">
          <p v-if="entry.attachments.length === 0" class="text-sm text-gray-500 dark:text-gray-400">Nenhum arquivo anexado.</p>
          <ul v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="attachment in entry.attachments" :key="attachment.id" class="flex min-w-0 items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <File :size="20" class="shrink-0 text-primary-600 dark:text-primary-400" />
              <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium dark:text-gray-100" :title="attachment.originalName">{{ attachment.originalName }}</p><p class="text-xs text-gray-500">{{ formatFileSize(attachment.size) }}</p></div>
              <button v-if="isPreviewable(attachment)" class="rounded p-1.5 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30" title="Visualizar" @click="openPreview(attachment)"><Eye :size="16" /></button>
              <button class="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" title="Baixar" @click="downloadAttachment(attachment)"><Download :size="16" /></button>
              <button
                v-if="canDeleteAttachments"
                class="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-900/30"
                title="Excluir anexo"
                :disabled="deletingAttachmentId === attachment.id"
                @click="handleDeleteAttachment(attachment)"
              ><Trash2 :size="16" /></button>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <BaseModal :open="!!previewAttachment" :title="previewAttachment?.originalName || 'Pré-visualização'" size="lg" @close="clearPreview">
      <p v-if="previewLoading" class="py-12 text-center text-sm text-gray-500">Carregando arquivo...</p>
      <img v-else-if="previewUrl && previewAttachment?.mimeType.startsWith('image/')" :src="previewUrl" :alt="previewAttachment.originalName" class="mx-auto max-h-[70vh] max-w-full object-contain" />
      <iframe v-else-if="previewUrl" :src="previewUrl" class="h-[70vh] w-full rounded border border-gray-200 dark:border-gray-700" title="Pré-visualização do PDF" />
    </BaseModal>

    <BaseModal :open="editOpen" title="Editar dados da entrada" size="lg" @close="editOpen = false">
      <form class="space-y-4" @submit.prevent="handleEdit">
        <p v-if="editError" class="break-all text-sm text-red-600 dark:text-red-400">{{ editError }}</p>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BaseInput v-model="editForm.supplierName" label="Fornecedor" />
          <BaseInput v-model="editForm.invoiceNumber" label="Número da nota" />
          <BaseInput v-model="editForm.invoiceSeries" label="Série" />
          <DateInput v-model="editForm.invoiceIssuedAt" label="Data de emissão" />
          <BaseInput v-model="editForm.invoiceTotal" :decimal-places="2" label="Valor total (R$)" />
          <div class="sm:col-span-2">
            <BaseInput v-model="editForm.invoiceAccessKey" label="Chave de acesso (44 dígitos)" />
          </div>
          <label class="block sm:col-span-2">
            <span class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Observações</span>
            <textarea
              v-model="editForm.notes"
              rows="4"
              maxlength="2000"
              class="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">Produtos, quantidades e custos não podem ser alterados por este formulário.</p>
        <div class="flex justify-end gap-2">
          <BaseButton type="button" variant="secondary" @click="editOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="editing">{{ editing ? 'Salvando...' : 'Salvar alterações' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
