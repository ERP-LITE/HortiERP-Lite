<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, FileSpreadsheet, Upload } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import { downloadCsv, parseCsv, readSpreadsheetFile, toCsv } from '@/lib/csv'
import { getApiErrorMessage } from '@/services/api'
import { toastSuccess } from '@/lib/alerts'
import { importProducts, type ImportProductRow, type ImportProductsResult } from '@/services/productsService'
import { FIELD_LABELS, TEMPLATE_HEADERS, mapSpreadsheetToRows } from '@/lib/productSpreadsheet'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; imported: [] }>()

const fileName = ref('')
const rows = ref<ImportProductRow[]>([])
const result = ref<ImportProductsResult | null>(null)
const createMissingRefs = ref(true)
const parseError = ref('')
const loading = ref(false)
const importing = ref(false)

const canImport = computed(
  () => result.value !== null && result.value.summary.invalid === 0 && result.value.summary.valid > 0,
)

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function reset() {
  fileName.value = ''
  rows.value = []
  result.value = null
  parseError.value = ''
  loading.value = false
  importing.value = false
}

function downloadTemplate() {
  const example = [
    ['Tomate Italiano', 'Legumes', 'Quilograma', 'TOM001', '7891234567890', '7,49', '11,90', '10', 'sim'],
    ['Alface Crespa', 'Verduras', 'Unidade', '', '', '2,30', '3,99', '5', 'sim'],
  ]
  downloadCsv('modelo-produtos', toCsv(TEMPLATE_HEADERS, example))
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  reset()
  fileName.value = file.name
  loading.value = true

  try {
    const table = parseCsv(await readSpreadsheetFile(file))
    if (table.length < 2) {
      parseError.value = 'A planilha precisa ter uma linha de cabeçalho e ao menos um produto.'
      return
    }

    const mapping = mapSpreadsheetToRows(table)
    if (mapping.missingFields.length > 0) {
      const nomes = mapping.missingFields.map((field) => `"${FIELD_LABELS[field]}"`).join(', ')
      parseError.value =
        `Não encontrei ${mapping.missingFields.length > 1 ? 'as colunas' : 'a coluna'} ${nomes} na planilha. ` +
        `O cabeçalho lido foi: ${mapping.headerRow.join(', ')}. Baixe o modelo para conferir o formato.`
      return
    }

    rows.value = mapping.rows

    await runPreview()
  } catch (error) {
    parseError.value = getApiErrorMessage(error, 'Não foi possível ler a planilha.')
  } finally {
    loading.value = false
  }
}

async function runPreview() {
  if (rows.value.length === 0) return
  loading.value = true
  try {
    result.value = await importProducts({
      rows: rows.value,
      dryRun: true,
      createMissingRefs: createMissingRefs.value,
    })
  } catch (error) {
    parseError.value = getApiErrorMessage(error, 'Não foi possível validar a planilha.')
  } finally {
    loading.value = false
  }
}

async function handleImport() {
  importing.value = true
  try {
    const response = await importProducts({ rows: rows.value, createMissingRefs: createMissingRefs.value })
    result.value = response
    if (response.summary.imported > 0) {
      toastSuccess(`${response.summary.imported} produto(s) importado(s) com sucesso`)
      emit('imported')
      emit('close')
    }
  } catch (error) {
    parseError.value = getApiErrorMessage(error, 'Não foi possível importar a planilha.')
  } finally {
    importing.value = false
  }
}

function downloadErrors() {
  if (!result.value) return
  downloadCsv(
    'erros-importacao',
    toCsv(
      ['linha', 'nome', 'problemas'],
      result.value.errors.map((item) => [item.line, item.name, item.errors.join(' | ')]),
    ),
  )
}
</script>

<template>
  <BaseModal :open="open" title="Importar produtos de uma planilha" size="lg" @close="emit('close')">
    <div class="space-y-5">
      <div class="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
        <p class="mb-2">
          Envie um arquivo <strong>.csv</strong> com uma linha por produto. As colunas
          <strong>nome</strong>, <strong>categoria</strong> e <strong>unidade</strong> são obrigatórias; as demais
          podem ficar em branco.
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
          @click="downloadTemplate"
        >
          <Download :size="15" /> Baixar planilha modelo
        </button>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label
          class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600 dark:border-gray-600 dark:text-gray-300"
        >
          <FileSpreadsheet :size="16" />
          {{ fileName || 'Escolher planilha (.csv)' }}
          <input class="sr-only" type="file" accept=".csv,text/csv" @change="handleFile" />
        </label>
        <BaseToggle v-model="createMissingRefs" label="Criar categorias e unidades que não existirem" @update:model-value="runPreview" />
      </div>

      <p v-if="parseError" class="text-sm text-red-600 dark:text-red-400">{{ parseError }}</p>
      <p v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Conferindo a planilha...</p>

      <template v-if="result && !loading">
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400">Linhas lidas</p>
            <p class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ result.summary.total }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400">Prontas</p>
            <p class="text-xl font-semibold text-primary-600 dark:text-primary-400">{{ result.summary.valid }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400">Com problema</p>
            <p
              class="text-xl font-semibold"
              :class="result.summary.invalid > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'"
            >
              {{ result.summary.invalid }}
            </p>
          </div>
        </div>

        <p
          v-if="result.summary.newCategories.length || result.summary.newUnits.length"
          class="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <span v-if="result.summary.newCategories.length">
            Serão criadas {{ result.summary.newCategories.length }} categoria(s):
            {{ result.summary.newCategories.join(', ') }}.
          </span>
          <span v-if="result.summary.newUnits.length">
            Serão criadas {{ result.summary.newUnits.length }} unidade(s): {{ result.summary.newUnits.join(', ') }}.
          </span>
        </p>

        <div v-if="result.errors.length" class="space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">O que precisa ser corrigido</h3>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
              @click="downloadErrors"
            >
              <Download :size="15" /> Baixar lista de erros
            </button>
          </div>
          <div class="app-modal-scrollbar max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Linha</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Produto</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Problema</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr v-for="item in result.errors" :key="item.line">
                  <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ item.line }}</td>
                  <td class="px-3 py-2 text-gray-900 dark:text-gray-100">{{ item.name || '—' }}</td>
                  <td class="px-3 py-2 text-red-600 dark:text-red-400">{{ item.errors.join(' · ') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="result.summary.omittedErrors > 0" class="text-xs text-gray-500 dark:text-gray-400">
            e mais {{ result.summary.omittedErrors }} linha(s) com problema não listadas aqui.
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Nada é importado enquanto houver linha com problema — corrija a planilha e envie de novo. Assim você não
            corre o risco de importar metade dos produtos e duplicar o resto na segunda tentativa.
          </p>
        </div>
      </template>
    </div>

    <div class="mt-6 flex justify-end gap-2">
      <BaseButton type="button" variant="secondary" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton type="button" :disabled="!canImport || importing" @click="handleImport">
        <Upload :size="16" />
        {{ importing ? 'Importando...' : `Importar ${result?.summary.valid ?? 0} produto(s)` }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
