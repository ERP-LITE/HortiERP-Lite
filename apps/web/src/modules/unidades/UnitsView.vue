<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import FilterModal from '@/components/ui/FilterModal.vue'
import Pagination from '@/components/ui/Pagination.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import BulkSelectionBar from '@/components/ui/BulkSelectionBar.vue'
import TableCheckbox from '@/components/ui/TableCheckbox.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import { statusFilterOptionsFor } from '@/lib/status'
import { createUnit, deleteUnit, deleteUnits, listUnits, updateUnit, type UnitInput } from '@/services/unitsService'
import { useAuthStore } from '@/stores/auth'
import { usePagination } from '@/composables/usePagination'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { useFilterModal } from '@/composables/useFilterModal'
import { useTableSort } from '@/composables/useTableSort'
import { LIMITES_TEXTO } from '@/lib/limits'
import type { Unit } from '@/types'

const auth = useAuthStore()
const canManage = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'gerente')

const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadUnits), 'name')

const units = ref<Unit[]>([])
const { selectedIds, allVisibleSelected, toggleOne, toggleAllVisible, clearSelection } = useBulkSelection(() =>
  units.value.map(({ id }) => id),
)
const deletingSelected = ref(false)
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  () => ({ active: 'todos' }),
  () => reload(loadUnits),
)
const activeFilterCount = computed(() => Number(filters.value.active !== 'todos'))
const statusFilterOptions = statusFilterOptionsFor('f')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const emptyForm: Required<UnitInput> = { name: '', abbreviation: '', active: true }
const form = ref<Required<UnitInput>>({ ...emptyForm })
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

async function loadUnits() {
  loading.value = true
  try {
    const result = await listUnits({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      active: filters.value.active === 'todos' ? undefined : filters.value.active === 'true',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    units.value = result.data
    clearSelection()
    applyMeta(result)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  editingId.value = null
  form.value = { ...emptyForm }
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEditModal(unit: Unit) {
  editingId.value = unit.id
  form.value = { name: unit.name, abbreviation: unit.abbreviation, active: unit.active }
  fieldErrors.value = {}
  modalOpen.value = true
}

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.value.name.trim()) fieldErrors.value.name = 'Informe o nome da unidade'
  if (!form.value.abbreviation.trim()) fieldErrors.value.abbreviation = 'Informe a abreviação'
  return Object.keys(fieldErrors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    if (editingId.value) {
      await updateUnit(editingId.value, form.value)
      toastSuccess('Unidade atualizada com sucesso')
    } else {
      await createUnit(form.value)
      toastSuccess('Unidade criada com sucesso')
    }
    modalOpen.value = false
    await loadUnits()
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível salvar a unidade')
    fieldErrors.value = result.fieldErrors
    if (result.message) toastError(result.message)
  } finally {
    saving.value = false
  }
}

async function handleDelete(unit: Unit) {
  const confirmed = await confirmDelete({
    title: `Excluir a unidade "${unit.name}"?`,
    text: 'Essa ação não pode ser desfeita.',
  })
  if (!confirmed) return

  try {
    await deleteUnit(unit.id)
    await loadUnits()
    toastSuccess('Unidade excluída com sucesso')
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível excluir a unidade'))
  }
}

async function handleBulkDelete() {
  const count = selectedIds.value.length
  const confirmed = await confirmDelete({
    title: `Excluir ${count} ${count === 1 ? 'unidade selecionada' : 'unidades selecionadas'}?`,
    text: 'Os registros serão excluídos logicamente e deixarão de aparecer no sistema.',
  })
  if (!confirmed) return

  deletingSelected.value = true
  try {
    const result = await deleteUnits(selectedIds.value)
    await loadUnits()
    toastSuccess(`${result.deleted} ${result.deleted === 1 ? 'unidade excluída' : 'unidades excluídas'} com sucesso`)
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível excluir as unidades selecionadas'))
  } finally {
    deletingSelected.value = false
  }
}

watchSearch(search, loadUnits)
onMounted(loadUnits)
</script>

<template>
  <div>
    <PageHeader title="Unidades de medida" subtitle="Ex.: quilograma, unidade, dúzia, caixa">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por nome ou abreviação..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <BaseButton v-if="canManage" class="!px-2.5 sm:!px-4" title="Nova unidade" aria-label="Nova unidade" @click="openCreateModal">
          <Plus :size="16" /> <span class="hidden sm:inline">Nova unidade</span>
        </BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <BulkSelectionBar
      v-if="canManage"
      :count="selectedIds.length"
      :deleting="deletingSelected"
      @clear="clearSelection"
      @delete="handleBulkDelete"
    />

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th v-if="canManage" class="print:hidden w-12 px-4 py-3">
              <TableCheckbox
                :checked="allVisibleSelected"
                label="Selecionar todas as unidades desta página"
                @toggle="toggleAllVisible"
              />
            </th>
            <SortableTableHeader field="name" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Nome</SortableTableHeader>
            <SortableTableHeader field="abbreviation" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Abreviação</SortableTableHeader>
            <SortableTableHeader field="active" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Situação</SortableTableHeader>
            <th v-if="canManage" data-actions class="print:hidden px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td :colspan="canManage ? 5 : 3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="units.length === 0">
            <td :colspan="canManage ? 5 : 3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma unidade cadastrada.
            </td>
          </tr>
          <tr
            v-for="unit in units"
            v-else
            :key="unit.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-700/40"
            :class="canManage ? 'cursor-pointer' : ''"
            :title="canManage ? 'Duplo clique para editar' : ''"
            @dblclick="canManage && openEditModal(unit)"
          >
            <td v-if="canManage" class="print:hidden px-4 py-3" @dblclick.stop @click.stop>
              <TableCheckbox
                :checked="selectedIds.includes(unit.id)"
                :label="`Selecionar unidade ${unit.name}`"
                @toggle="toggleOne(unit.id)"
              />
            </td>
            <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="unit.name" :max-length="45" />
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ unit.abbreviation }}</td>
            <td class="px-4 py-3 whitespace-nowrap">
              <StatusBadge :active="unit.active" genero="f" />
            </td>
            <td v-if="canManage" class="print:hidden px-4 py-3 text-right space-x-1 whitespace-nowrap" @dblclick.stop>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Editar"
                @click="openEditModal(unit)"
              >
                <Pencil :size="16" />
              </button>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                title="Excluir"
                @click="handleDelete(unit)"
              >
                <Trash2 :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-bind="paginationProps" />
    </div>

    <FilterModal
      :open="filterModalOpen"
      title="Filtrar unidades"
      @close="filterModalOpen = false"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseSelect v-model="draftFilters.active" label="Situação" :options="statusFilterOptions" />
    </FilterModal>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar unidade' : 'Nova unidade'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput
          v-model="form.name"
          label="Nome"
          :maxlength="LIMITES_TEXTO.nome"
          :error="fieldErrors.name"
          required
        />
        <BaseInput
          v-model="form.abbreviation"
          label="Abreviação"
          :maxlength="LIMITES_TEXTO.abreviacao"
          :error="fieldErrors.abbreviation"
          required
        />
        <BaseToggle v-model="form.active" label="Unidade ativa" />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Unidade inativa continua valendo para os produtos que já usam ela, e deixa de aparecer na hora de
          cadastrar produto novo.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
