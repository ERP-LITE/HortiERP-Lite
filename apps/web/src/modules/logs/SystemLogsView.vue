<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Eye } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import DetailField from '@/components/ui/DetailField.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import FilterModal from '@/components/ui/FilterModal.vue'
import Pagination from '@/components/ui/Pagination.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { useFilterModal } from '@/composables/useFilterModal'
import { usePagination } from '@/composables/usePagination'
import { useTableSort } from '@/composables/useTableSort'
import { useIsMobile } from '@/composables/useIsMobile'
import { listAllCompanies } from '@/services/companiesService'
import { listTechnicalLogs } from '@/services/logsService'
import type { PeriodValue } from '@/lib/period'
import { formatDateTime } from '@/lib/format'
import { roleLabel } from '@/lib/roles'
import type { Company, SystemLog, SystemLogLevel, SystemLogMethod } from '@/types'

const props = defineProps<{ mode: 'technical' | 'activity' }>()
const isTechnical = computed(() => props.mode === 'technical')
const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadLogs), 'createdAt', 'desc')

const logs = ref<SystemLog[]>([])
const companies = ref<Company[]>([])
const { loading, errorMessage, withLoading, captureError } = useAsyncState()
const search = ref('')
const selectedLog = ref<SystemLog | null>(null)

const isMobile = useIsMobile()

function emptyFilters() {
  return {
    method: 'todos',
    level: 'todos',
    companyId: 'todas',
    period: { preset: 'todos', from: '', to: '' } as PeriodValue,
  }
}

const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  emptyFilters,
  () => reload(loadLogs),
)
const activeFilterCount = computed(
  () =>
    Number(filters.value.method !== 'todos') +
    Number(isTechnical.value && filters.value.level !== 'todos') +
    Number(isTechnical.value && filters.value.companyId !== 'todas') +
    Number(filters.value.period.preset !== 'todos'),
)

const methodOptions = [
  { value: 'todos', label: 'Todos os métodos' },
  { value: 'GET', label: 'GET (consulta)' },
  { value: 'POST', label: 'POST (criação/ação)' },
  { value: 'PUT', label: 'PUT (atualização)' },
  { value: 'PATCH', label: 'PATCH (alteração parcial)' },
  { value: 'DELETE', label: 'DELETE (exclusão)' },
]
const levelOptions = [
  { value: 'todos', label: 'Todos os níveis' },
  { value: 'info', label: 'Informação' },
  { value: 'warning', label: 'Alerta' },
  { value: 'error', label: 'Erro' },
]
const companyOptions = computed(() => [
  { value: 'todas', label: 'Todas as empresas' },
  ...companies.value.map((company) => ({ value: company.id, label: company.name })),
])

const levelLabels: Record<SystemLogLevel, string> = {
  info: 'Informação',
  warning: 'Alerta',
  error: 'Erro',
}
const levelVariants: Record<SystemLogLevel, 'success' | 'warning' | 'danger'> = {
  info: 'success',
  warning: 'warning',
  error: 'danger',
}

function resourceLabel(path: string) {
  const labels: Record<string, string> = {
    auth: 'Autenticação',
    companies: 'Empresas',
    categories: 'Categorias',
    units: 'Unidades',
    products: 'Produtos',
    users: 'Usuários',
    'stock-entries': 'Entradas',
    stock: 'Estoque',
    losses: 'Perdas',
    dashboard: 'Dashboard',
    reports: 'Relatórios',
  }
  const resource = path.replace(/^\/api\//, '').split('/')[0]
  return labels[resource] ?? resource
}

function actionLabel(log: SystemLog) {
  const actions: Record<SystemLogMethod, string> = {
    GET: 'Consultou',
    POST: 'Criou/executou',
    PUT: 'Atualizou',
    PATCH: 'Alterou',
    DELETE: 'Excluiu',
  }
  return `${actions[log.method]} ${resourceLabel(log.path)}`
}

async function loadLogs() {
  await withLoading(async () => {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      method: filters.value.method !== 'todos' ? (filters.value.method as SystemLogMethod) : undefined,
      level:
        isTechnical.value && filters.value.level !== 'todos'
          ? (filters.value.level as SystemLogLevel)
          : undefined,
      companyId:
        isTechnical.value && filters.value.companyId !== 'todas' ? filters.value.companyId : undefined,
      from: filters.value.period.from || undefined,
      to: filters.value.period.to || undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    }
    const result = await listTechnicalLogs(params)
    logs.value = result.data
    applyMeta(result)
  })
}

async function loadCompanies() {
  if (!isTechnical.value) return
  await captureError(async () => {
    companies.value = await listAllCompanies()
  })
}

watchSearch(search, loadLogs)
onMounted(() => {
  loadLogs()
  loadCompanies()
})
</script>

<template>
  <div>
    <PageHeader
      :title="isTechnical ? 'Logs técnicos' : 'Logs de atividades'"
      :subtitle="
        isTechnical
          ? 'Diagnóstico de requisições e erros de todas as empresas'
          : 'Histórico de operações realizadas na sua empresa'
      "
    >
      <template #actions>
        <SearchInput v-model="search" :placeholder="isTechnical ? 'Buscar rota, empresa ou erro...' : 'Buscar ação ou usuário...'" />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

    <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <SortableTableHeader field="createdAt" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Data</SortableTableHeader>
            <SortableTableHeader v-if="isTechnical" field="companyName" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Empresa</SortableTableHeader>
            <SortableTableHeader field="actorName" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Usuário</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Evento</th>
            <SortableTableHeader v-if="isTechnical" field="level" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Nível</SortableTableHeader>
            <th data-actions class="print:hidden px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td :colspan="isTechnical ? 6 : 4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Carregando...
            </td>
          </tr>
          <tr v-else-if="logs.length === 0">
            <td :colspan="isTechnical ? 6 : 4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum log encontrado.
            </td>
          </tr>
          <tr
            v-for="log in logs"
            v-else
            :key="log.id"
            class="hover:bg-gray-50 sm:cursor-pointer dark:hover:bg-gray-700/40"
            :title="isMobile ? '' : 'Clique para ver os detalhes'"
            @click="!isMobile && (selectedLog = log)"
          >
            <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDateTime(log.createdAt) }}
            </td>
            <td v-if="isTechnical" class="max-w-64 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="log.companyName" :max-length="40" empty-text="Plataforma/visitante" />
            </td>
            <td class="max-w-72 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
              <div class="min-w-0">
                <ExpandableText :text="log.actorName" :max-length="40" empty-text="Não identificado" class="block font-medium" />
                <ExpandableText v-if="log.actorEmail" :text="log.actorEmail" :max-length="45" class="mt-0.5 block text-xs text-gray-400" />
              </div>
            </td>
            <td class="min-w-56 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
              <div class="min-w-0">
                <span class="block font-medium">{{ actionLabel(log) }}</span>
                <ExpandableText
                  v-if="isTechnical"
                  :text="`${log.method} ${log.path} · HTTP ${log.statusCode} · ${log.durationMs} ms`"
                  :max-length="65"
                  class="mt-0.5 block font-mono text-xs text-gray-400"
                />
              </div>
            </td>
            <td v-if="isTechnical" class="whitespace-nowrap px-4 py-3">
              <BaseBadge :variant="levelVariants[log.level]">{{ levelLabels[log.level] }}</BaseBadge>
            </td>
            <td class="print:hidden whitespace-nowrap px-4 py-3 text-right" @click.stop>
              <button
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Ver detalhes"
                @click="selectedLog = log"
              >
                <Eye :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-bind="paginationProps" />
    </div>

    <FilterModal
      :open="filterModalOpen"
      title="Filtrar logs"
      @close="filterModalOpen = false"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseSelect v-if="isTechnical" v-model="draftFilters.companyId" label="Empresa" :options="companyOptions" />
      <BaseSelect v-model="draftFilters.method" label="Método/operação" :options="methodOptions" />
      <BaseSelect v-if="isTechnical" v-model="draftFilters.level" label="Nível" :options="levelOptions" />
      <PeriodPicker v-model="draftFilters.period" />
    </FilterModal>

    <BaseModal :open="!!selectedLog" title="Detalhes do log" @close="selectedLog = null">
      <dl v-if="selectedLog" class="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <DetailField label="Data e hora">{{ formatDateTime(selectedLog.createdAt) }}</DetailField>
        <DetailField label="Empresa">{{ selectedLog.companyName || 'Plataforma/visitante' }}</DetailField>
        <DetailField label="Usuário">{{ selectedLog.actorName || 'Não identificado' }}</DetailField>
        <DetailField label="Perfil">{{ roleLabel(selectedLog.actorRole) }}</DetailField>
        <DetailField label="Evento" wide>{{ actionLabel(selectedLog) }}</DetailField>
        <template v-if="isTechnical">
          <DetailField label="Rota" wide mono>{{ selectedLog.method }} {{ selectedLog.path }}</DetailField>
          <DetailField label="Resposta">HTTP {{ selectedLog.statusCode }}</DetailField>
          <DetailField label="Duração">{{ selectedLog.durationMs }} ms</DetailField>
          <DetailField label="IP">{{ selectedLog.ip || '—' }}</DetailField>
          <DetailField label="Código do erro">{{ selectedLog.errorCode || '—' }}</DetailField>
          <div v-if="selectedLog.errorMessage" class="sm:col-span-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mensagem do erro</dt>
            <dd class="mt-1 break-all rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {{ selectedLog.errorMessage }}
            </dd>
          </div>
          <DetailField label="Navegador/cliente" wide mono>{{ selectedLog.userAgent || '—' }}</DetailField>
        </template>
      </dl>
    </BaseModal>
  </div>
</template>
