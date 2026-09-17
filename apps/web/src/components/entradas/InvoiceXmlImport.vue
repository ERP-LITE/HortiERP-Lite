<script setup lang="ts">
import { ref } from 'vue'
import { FileCode } from '@lucide/vue'
import FilePickerArea from '@/components/ui/FilePickerArea.vue'
import { getApiErrorMessage } from '@/services/api'
import { readInvoiceXml } from '@/services/stockEntriesService'
import { MAX_INVOICE_FILE_SIZE } from '@/lib/invoiceAttachments'
import { formatFileSize } from '@/lib/format'
import type { NotaFiscalLida } from '@/types'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ read: [nota: NotaFiscalLida, arquivo: File] }>()

const lendo = ref(false)
const errorMessage = ref('')

async function handleFile([file]: File[]) {
  errorMessage.value = ''
  if (file.size > MAX_INVOICE_FILE_SIZE) {
    errorMessage.value = `${file.name} tem ${formatFileSize(file.size)} e o limite é ${MAX_INVOICE_FILE_SIZE / 1024 / 1024} MB`
    return
  }

  lendo.value = true
  try {
    emit('read', await readInvoiceXml(file), file)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível ler o XML da nota')
  } finally {
    lendo.value = false
  }
}
</script>

<template>
  <section class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
    <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Começar pelo XML da nota</h2>
    <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
      O sistema lê o arquivo, preenche os dados da nota e os itens, e liga cada item ao seu produto pelo código
      de barras ou pelo que você já ensinou desse fornecedor. Nada é salvo antes de você conferir.
    </p>

    <FilePickerArea
      class="mt-3"
      accept=".xml,application/xml,text/xml"
      :icon="FileCode"
      :disabled="disabled || lendo"
      @select="handleFile"
    >
      {{ lendo ? 'Lendo a nota...' : 'Selecionar XML da NF-e' }}
    </FilePickerArea>

    <p v-if="errorMessage" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ errorMessage }}</p>
  </section>
</template>
