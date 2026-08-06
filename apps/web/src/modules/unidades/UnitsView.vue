<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import Pagination from '@/components/ui/Pagination.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import BulkSelectionBar from '@/components/ui/BulkSelectionBar.vue'
import TableCheckbox from '@/components/ui/TableCheckbox.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import { createUnit, deleteUnit, deleteUnits, listUnits, updateUnit, type UnitInput } from '@/services/unitsService'
import { useAuthStore } from '@/stores/auth'
import { usePagination } from '@/composables/usePagination'
import { useBulkSelection } from '@/composables/useBulkSelection'
import type { Unit } from '@/types'

const auth = useAuthStore()
const canManage = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'gerente')

const { page, pageSize, total, totalPages, applyMeta, watchSearch } = usePagination()

const units = ref<Unit[]>([])
const { selectedIds, allVisibleSelected, toggleOne, toggleAllVisible, clearSelection } = useBulkSelection(() =>
  units.value.map(({ id }) => id),
)
const deletingSelected = ref(false)
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref<UnitInput>({ name: '', abbreviation: '' })
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

async function loadUnits() {
  loading.value = true
  try {
    const result = await listUnits({ page: page.value, pageSize: pageSize.value, search: search.value || undefined })
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
  form.value = { name: '', abbreviation: '' }
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEditModal(unit: Unit) {
  editingId.value = unit.id
  form.value = { name: unit.name, abbreviation: unit.abbreviation }
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
    errorMessage.value = result.message
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
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Abreviação
            </th>
            <th class="print:hidden px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td :colspan="canManage ? 4 : 3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="units.length === 0">
            <td :colspan="canManage ? 4 : 3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
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
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ unit.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ unit.abbreviation }}</td>
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
            <td v-else class="print:hidden px-4 py-3" />
          </tr>
        </tbody>
      </table>
      <Pagination
        :page="page"
        :page-size="pageSize"
        :total="total"
        :total-pages="totalPages"
        @update:page="page = $event"
        @update:page-size="pageSize = $event"
      />
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar unidade' : 'Nova unidade'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="form.name" label="Nome" :error="fieldErrors.name" />
        <BaseInput v-model="form.abbreviation" label="Abreviação" :error="fieldErrors.abbreviation" />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
