<script setup lang="ts">
import { ref } from 'vue'
import { Download } from '@lucide/vue'
import { downloadCsv, toCsv } from '@/lib/csv'
import { getApiErrorMessage } from '@/services/api'
import { toastError, toastSuccess } from '@/lib/alerts'

const props = defineProps<{
  fileName: string
  load: () => Promise<{ headers: string[]; rows: unknown[][] }>
}>()

const loading = ref(false)

async function handleExport() {
  if (loading.value) return

  loading.value = true
  try {
    const { headers, rows } = await props.load()
    if (rows.length === 0) {
      toastError('Não há registros para exportar com os filtros atuais')
      return
    }

    const today = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-')
    downloadCsv(`${props.fileName}-${today}`, toCsv(headers, rows))
    toastSuccess(`${rows.length} registro(s) exportado(s)`)
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível exportar os dados'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="print:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    :title="loading ? 'Exportando...' : 'Exportar para planilha (CSV)'"
    :aria-label="loading ? 'Exportando...' : 'Exportar para planilha (CSV)'"
    :disabled="loading"
    @click="handleExport"
  >
    <Download :size="18" :class="{ 'animate-pulse': loading }" />
  </button>
</template>
