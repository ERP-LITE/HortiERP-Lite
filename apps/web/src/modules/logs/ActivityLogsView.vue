<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Eye } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import DetailField from '@/components/ui/DetailField.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import ExportCsvButton from '@/components/ui/ExportCsvButton.vue'
import Pagination from '@/components/ui/Pagination.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { useIsMobile } from '@/composables/useIsMobile'
import { formatDateTime } from '@/lib/format'
import { activityDetailsText, describeActivityDetails } from '@/lib/activityDetails'
import type { PeriodValue } from '@/lib/period'
import { listActivityLogs, listAllActivityLogs } from '@/services/logsService'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import { useTableSort } from '@/composables/useTableSort'
import type { ActivityAction, ActivityEntity, ActivityLog } from '@/types'

const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadLogs), 'createdAt')

const logs = ref<ActivityLog[]>([])
const { loading, errorMessage, withLoading } = useAsyncState()
const search = ref('')

const actionOptions = [
  { value: 'todos', label: 'Todas as ações' },
  { value: 'criou', label: 'Cadastrou' },
  { value: 'alterou', label: 'Alterou' },
  { value: 'excluiu', label: 'Excluiu' },
  { value: 'importou', label: 'Importou' },
  { value: 'ajustou', label: 'Ajustou' },
  { value: 'cancelou', label: 'Cancelou' },
]
const entityOptions = [
  { value: 'todos', label: 'Todos os registros' },
  { value: 'produto', label: 'Produtos' },
  { value: 'categoria', label: 'Categorias' },
  { value: 'unidade', label: 'Unidades' },
  { value: 'usuario', label: 'Usuários' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'perda', label: 'Perdas' },
  { value: 'estoque', label: 'Estoque' },
]

const actionLabels: Record<ActivityAction, string> = {
  criou: 'Cadastrou',
  alterou: 'Alterou',
  excluiu: 'Excluiu',
  importou: 'Importou',
  ajustou: 'Ajustou',
  cancelou: 'Cancelou',
}
const entityLabels: Record<ActivityEntity, string> = {
  produto: 'produto',
  categoria: 'categoria',
  unidade: 'unidade',
  usuario: 'usuário',
  entrada: 'entrada',
  perda: 'perda',
  estoque: 'estoque',
}
const actionVariant: Record<ActivityAction, 'success' | 'warning' | 'danger' | 'neutral'> = {
  criou: 'success',
  alterou: 'warning',
  excluiu: 'danger',
  importou: 'success',
  ajustou: 'warning',
  cancelou: 'warning',
}

const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  () => ({ action: 'todos', entity: 'todos', period: { preset: 'todos', from: '', to: '' } as PeriodValue }),
  () => reload(loadLogs),
)
const activeFilterCount = computed(
  () =>
    Number(filters.value.action !== 'todos') +
    Number(filters.value.entity !== 'todos') +
    Number(Boolean(filters.value.period.from || filters.value.period.to)),
)

const selectedLog = ref<ActivityLog | null>(null)
const detailItems = computed(() => describeActivityDetails(selectedLog.value?.details))

const isMobile = useIsMobile()

function queryParams() {
  return {
    search: search.value || undefined,
    action: filters.value.action !== 'todos' ? (filters.value.action as ActivityAction) : undefined,
    entity: filters.value.entity !== 'todos' ? (filters.value.entity as ActivityEntity) : undefined,
    from: filters.value.period.from || undefined,
    to: filters.value.period.to || undefined,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  }
}

function describe(log: ActivityLog) {
  return `${actionLabels[log.action]} ${entityLabels[log.entity]}`
}

async function loadLogs() {
  await withLoading(async () => {
    const result = await listActivityLogs({ page: page.value, pageSize: pageSize.value, ...queryParams() })
    logs.value = result.data
    applyMeta(result)
  })
}

async function exportCsv() {
  const all = await listAllActivityLogs(queryParams())
  return {
    headers: ['Data', 'Usuario', 'Acao', 'Tipo de registro', 'Registro', 'Detalhes'],
    rows: all.map((log) => [
      formatDateTime(log.createdAt),
      log.actorName ?? 'Usuário não identificado',
      actionLabels[log.action],
      entityLabels[log.entity],
      log.entityLabel,
      activityDetailsText(log.details),
    ]),
  }
}

watchSearch(search, loadLogs)
onMounted(loadLogs)
</script>

<template>
  <div>
    <PageHeader
      title="Logs de atividades"
      subtitle="Quem cadastrou, alterou ou excluiu cada registro da sua empresa"
    >
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar registro ou usuário..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <ExportCsvButton file-name="atividades" :load="exportCsv" />
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="overflow-x-auto">
        <table v-mobile-accordion class="mobile-accordion-table w-full">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <SortableTableHeader field="createdAt" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">
                Data
              </SortableTableHeader>
              <SortableTableHeader field="actorName" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">
                Usuário
              </SortableTableHeader>
              <SortableTableHeader field="action" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">
                Ação
              </SortableTableHeader>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Registro
              </th>
              <th data-actions class="print:hidden px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="loading">
              <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
            </tr>
            <tr v-else-if="logs.length === 0">
              <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhuma atividade registrada no período.
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
              <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                <ExpandableText :text="log.actorName ?? 'Usuário não identificado'" />
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                <BaseBadge :variant="actionVariant[log.action]">{{ describe(log) }}</BaseBadge>
              </td>
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                <ExpandableText :text="log.entityLabel" />
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
      </div>

      <Pagination v-bind="paginationProps" />
    </div>

    <BaseModal :open="filterModalOpen" title="Filtrar atividades" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <BaseSelect v-model="draftFilters.action" label="Ação" :options="actionOptions" />
        <BaseSelect v-model="draftFilters.entity" label="Tipo de registro" :options="entityOptions" />
        <PeriodPicker v-model="draftFilters.period" />
        <div class="flex justify-between gap-2 pt-2">
          <BaseButton type="button" variant="ghost" @click="clearFilters">Limpar</BaseButton>
          <div class="flex gap-2">
            <BaseButton type="button" variant="secondary" @click="filterModalOpen = false">Cancelar</BaseButton>
            <BaseButton type="submit">Aplicar</BaseButton>
          </div>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="Boolean(selectedLog)" title="Detalhes da atividade" @close="selectedLog = null">
      <dl v-if="selectedLog" class="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <DetailField label="Data">{{ formatDateTime(selectedLog.createdAt) }}</DetailField>
        <DetailField label="Usuário">{{ selectedLog.actorName ?? 'Usuário não identificado' }}</DetailField>
        <DetailField label="E-mail">{{ selectedLog.actorEmail ?? '—' }}</DetailField>
        <DetailField label="Ação">{{ describe(selectedLog) }}</DetailField>
        <DetailField label="Registro" wide>{{ selectedLog.entityLabel }}</DetailField>
        <div v-if="detailItems.length" class="border-t border-gray-100 pt-4 sm:col-span-2 dark:border-gray-700">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Informações adicionais
          </p>
          <dl class="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <DetailField v-for="item in detailItems" :key="item.label" :label="item.label">
              {{ item.value }}
            </DetailField>
          </dl>
        </div>
      </dl>
    </BaseModal>
  </div>
</template>
