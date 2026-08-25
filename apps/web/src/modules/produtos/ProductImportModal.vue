<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, FileSpreadsheet, Upload } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { downloadCsv, parseCsv, readSpreadsheetFile, toCsv } from '@/lib/csv'
import { formatCurrency, formatQuantity } from '@/lib/format'
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
const importedPartially = ref(false)
const listaAberta = ref<'prontas' | 'problemas'>('prontas')

const canImport = computed(() => (result.value?.summary.valid ?? 0) > 0 && !importedPartially.value)
const hasErrors = computed(() => (result.value?.summary.invalid ?? 0) > 0)
const showTabs = computed(
  () => !importedPartially.value && (result.value?.preview.length ?? 0) > 0 && (result.value?.errors.length ?? 0) > 0,
)
const mostrarProntas = computed(
  () => !importedPartially.value && (result.value?.preview.length ?? 0) > 0 && (!showTabs.value || listaAberta.value === 'prontas'),
)
const mostrarProblemas = computed(
  () => (result.value?.errors.length ?? 0) > 0 && (!showTabs.value || listaAberta.value === 'problemas'),
)
const importLabel = computed(() => {
  const valid = result.value?.summary.valid ?? 0
  return hasErrors.value ? `Importar as ${valid} válida(s)` : `Importar ${valid} produto(s)`
})

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

// A lista que pede ação é a que abre: com linha errada, quem confere quer ver o que precisa corrigir
watch(result, (atual) => {
  listaAberta.value = (atual?.summary.invalid ?? 0) > 0 ? 'problemas' : 'prontas'
})

function reset() {
  fileName.value = ''
  rows.value = []
  result.value = null
  parseError.value = ''
  loading.value = false
  importing.value = false
  importedPartially.value = false
  listaAberta.value = 'prontas'
}

function downloadTemplate() {
  const example = [
    ['Tomate Italiano', 'Legumes', 'Quilograma', 'TOM001', '7891234567890', '7,49', '11,90', '10', '38,5', 'sim'],
    ['Alface Crespa', 'Verduras', 'Unidade', '', '', '2,30', '3,99', '5', '12', 'sim'],
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
  if (rows.value.length === 0 || importedPartially.value) return
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
  const deixandoDeFora = hasErrors.value
  try {
    const response = await importProducts({
      rows: rows.value,
      createMissingRefs: createMissingRefs.value,
      skipInvalid: deixandoDeFora,
    })
    if (response.summary.imported > 0) {
      toastSuccess(`${response.summary.imported} produto(s) importado(s) com sucesso`)
      emit('imported')
      // Com linha de fora, o modal continua aberto: fechar jogaria fora a lista do que falta corrigir
      if (deixandoDeFora) importedPartially.value = true
      else emit('close')
    }
    result.value = response
  } catch (error) {
    parseError.value = getApiErrorMessage(error, 'Não foi possível importar a planilha.')
  } finally {
    importing.value = false
  }
}

/**
 * A lista sai no mesmo formato da planilha modelo, com uma coluna de problema no fim: o arquivo
 * baixado é o que a pessoa corrige e reenvia, sem precisar caçar as linhas na planilha original.
 */
function downloadErrors() {
  if (!result.value) return
  const rowByLine = new Map(rows.value.map((row) => [row.line, row]))
  const linhas = result.value.errors.map((item) => {
    const row = rowByLine.get(item.line)
    return [
      row?.name ?? item.name,
      row?.categoryName ?? '',
      row?.unitName ?? '',
      row?.sku ?? '',
      row?.barcode ?? '',
      row?.costPrice ?? '',
      row?.salePrice ?? '',
      row?.minStock ?? '',
      row?.currentStock ?? '',
      row?.active ?? '',
      item.errors.join(' | '),
    ]
  })
  downloadCsv('produtos-para-corrigir', toCsv([...TEMPLATE_HEADERS, 'problema'], linhas))
}
</script>

<template>
  <BaseModal :open="open" title="Importar produtos de uma planilha" size="lg" fit @close="emit('close')">
    <div class="flex flex-col gap-4 sm:min-h-0 sm:flex-1">
      <div v-if="!result" class="shrink-0 rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
        <p class="mb-2">
          Envie um arquivo <strong>.csv</strong> com uma linha por produto. As colunas
          <strong>nome</strong>, <strong>categoria</strong> e <strong>unidade</strong> são obrigatórias; as demais
          podem ficar em branco. Se preencher <strong>estoque atual</strong>, a quantidade entra como um ajuste
          registrado no histórico, com o motivo “carga inicial”.
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
          @click="downloadTemplate"
        >
          <Download :size="15" /> Baixar planilha modelo
        </button>
      </div>

      <div class="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <p class="shrink-0 text-sm text-gray-600 dark:text-gray-300">
          <strong class="font-semibold text-gray-900 dark:text-gray-100">{{ result.summary.total }}</strong>
          linha(s) lida(s) na planilha<template v-if="!showTabs">,
            <strong
              class="font-semibold"
              :class="result.summary.invalid > 0 ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-400'"
            >{{ result.summary.invalid > 0 ? result.summary.invalid : result.summary.valid }}</strong>
            {{ result.summary.invalid > 0 ? 'com problema' : 'pronta(s) para importar' }}</template>.
        </p>

        <div
          v-if="importedPartially"
          class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/30 dark:text-green-200"
        >
          <p class="font-medium">{{ result.summary.imported }} produto(s) importado(s).</p>
          <p class="mt-1">
            As {{ result.summary.invalid }} linha(s) abaixo ficaram de fora e não foram criadas. Baixe a lista,
            corrija e envie só ela numa nova importação.
          </p>
        </div>

        <div
          v-if="showTabs"
          class="flex shrink-0 gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium dark:bg-gray-900"
          role="tablist"
        >
          <button
            v-for="aba in [
              { id: 'prontas', label: `Prontas (${result.summary.valid})` },
              { id: 'problemas', label: `Com problema (${result.summary.invalid})` },
            ]"
            :key="aba.id"
            type="button"
            role="tab"
            :aria-selected="listaAberta === aba.id"
            class="flex-1 rounded-md px-3 py-1.5 transition-colors"
            :class="
              listaAberta === aba.id
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            "
            @click="listaAberta = aba.id as 'prontas' | 'problemas'"
          >
            {{ aba.label }}
          </button>
        </div>

        <div v-if="mostrarProntas" class="flex flex-col gap-2 sm:min-h-0 sm:flex-1">
          <div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">O que vai ser importado</h3>
            <div class="flex flex-wrap gap-1.5">
              <BaseBadge variant="success">{{ result.summary.valid }} produto(s)</BaseBadge>
              <BaseBadge v-if="result.summary.newCategories.length" variant="warning">
                {{ result.summary.newCategories.length }} categoria(s) nova(s)
              </BaseBadge>
              <BaseBadge v-if="result.summary.newUnits.length" variant="warning">
                {{ result.summary.newUnits.length }} unidade(s) nova(s)
              </BaseBadge>
              <BaseBadge v-if="result.summary.withInitialStock" variant="neutral">
                {{ result.summary.withInitialStock }} com estoque inicial
              </BaseBadge>
              <BaseBadge v-if="result.summary.initialStockWithoutCost" variant="danger">
                {{ result.summary.initialStockWithoutCost }} sem custo
              </BaseBadge>
              <BaseBadge v-if="result.summary.inactive" variant="danger">
                {{ result.summary.inactive }} inativo(s)
              </BaseBadge>
            </div>
          </div>

            <div
            class="app-modal-scrollbar max-h-80 overflow-auto overscroll-contain rounded-lg border border-gray-200 sm:max-h-none sm:min-h-24 sm:flex-1 dark:border-gray-700"
          >
            <table class="w-full min-w-[44rem] text-sm">
              <thead class="sticky top-0 bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Linha</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Produto</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Categoria</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Unidade</th>
                  <th class="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Custo</th>
                  <th class="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Venda</th>
                  <th class="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Mínimo</th>
                  <th class="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Inicial</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr v-for="item in result.preview" :key="item.line">
                  <td class="px-3 py-2 align-top text-gray-500 dark:text-gray-400">{{ item.line }}</td>
                  <td class="px-3 py-2 align-top">
                    <span class="block font-medium text-gray-900 dark:text-gray-100">
                      {{ item.name }}
                      <BaseBadge v-if="!item.active" variant="danger" class="ml-1">inativo</BaseBadge>
                    </span>
                    <span v-if="item.sku || item.barcode" class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {{ [item.sku, item.barcode].filter(Boolean).join(' · ') }}
                    </span>
                  </td>
                  <td class="px-3 py-2 align-top text-gray-600 dark:text-gray-300">
                    {{ item.categoryName }}
                    <BaseBadge v-if="item.newCategory" variant="warning" class="ml-1">nova</BaseBadge>
                    <BaseBadge v-else-if="item.inactiveCategory" variant="danger" class="ml-1">inativa</BaseBadge>
                  </td>
                  <td class="px-3 py-2 align-top text-gray-600 dark:text-gray-300">
                    {{ item.unitName }}
                    <BaseBadge v-if="item.newUnit" variant="warning" class="ml-1">nova</BaseBadge>
                    <BaseBadge v-else-if="item.inactiveUnit" variant="danger" class="ml-1">inativa</BaseBadge>
                  </td>
                  <td
                    class="whitespace-nowrap px-3 py-2 text-right align-top"
                    :class="item.costPrice === null && item.initialStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'"
                  >
                    {{ item.costPrice === null ? 'sem custo' : formatCurrency(item.costPrice) }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2 text-right align-top text-gray-600 dark:text-gray-300">
                    {{ item.salePrice === null ? '—' : formatCurrency(item.salePrice) }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2 text-right align-top text-gray-600 dark:text-gray-300">
                    {{ formatQuantity(item.minStock) }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2 text-right align-top text-gray-600 dark:text-gray-300">
                    {{ formatQuantity(item.initialStock) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="(result.omittedPreview ?? 0) > 0" class="text-xs text-gray-500 dark:text-gray-400">
            e mais {{ result.omittedPreview }} produto(s) não listados aqui.
          </p>
          <p v-if="result.summary.newCategories.length || result.summary.newUnits.length" class="text-xs text-gray-500 dark:text-gray-400">
            Serão criadas junto com a importação:
            {{ [...result.summary.newCategories, ...result.summary.newUnits].join(', ') }}.
          </p>
          <p v-if="result.summary.withInitialStock > 0" class="text-xs text-gray-500 dark:text-gray-400">
            O estoque inicial entra no histórico como ajuste, com o motivo “carga inicial”, e soma
            {{ formatCurrency(result.summary.initialStockValue) }} pelo custo da planilha.
            <span v-if="result.summary.initialStockWithoutCost > 0" class="font-medium text-red-600 dark:text-red-400">
              Sem custo, esse estoque vale R$ 0,00 nos relatórios e no painel até o custo ser informado.
            </span>
          </p>
        </div>

        <div v-if="mostrarProblemas" class="flex flex-col gap-2 sm:min-h-0 sm:flex-1">
          <div class="flex shrink-0 items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">O que precisa ser corrigido</h3>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
              @click="downloadErrors"
            >
              <Download :size="15" /> Baixar lista de erros
            </button>
          </div>
            <div
            class="app-modal-scrollbar max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-gray-200 sm:max-h-none sm:min-h-24 sm:flex-1 dark:border-gray-700"
          >
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
          <p v-if="result.summary.omittedErrors > 0" class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
            e mais {{ result.summary.omittedErrors }} linha(s) com problema não listadas aqui.
          </p>
        </div>

        <p v-if="result.errors.length && !importedPartially" class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
          Você pode importar agora só as linhas prontas: as com problema ficam de fora e nada é criado pela metade.
          Em <strong>Baixar lista de erros</strong> vem uma planilha já no formato da importação, com o motivo de cada
          linha: corrija ali e envie <strong>só esse arquivo</strong> depois, para não duplicar o que já entrou.
        </p>
      </template>
    </div>

    <div class="mt-4 flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
      <BaseButton type="button" variant="secondary" @click="emit('close')">
        {{ importedPartially ? 'Fechar' : 'Cancelar' }}
      </BaseButton>
      <BaseButton v-if="!importedPartially" type="button" :disabled="!canImport || importing" @click="handleImport">
        <Upload :size="16" />
        {{ importing ? 'Importando...' : importLabel }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
