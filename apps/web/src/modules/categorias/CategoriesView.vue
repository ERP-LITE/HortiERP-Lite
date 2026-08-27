<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
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
import ExpandableText from '@/components/ui/ExpandableText.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { statusFilterOptionsFor } from '@/lib/status'
import {
  createCategory,
  deleteCategories,
  deleteCategory,
  listCategories,
  updateCategory,
  type CategoryInput,
} from '@/services/categoriesService'
import { useAsyncState } from '@/composables/useAsyncState'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { useCrudModal } from '@/composables/useCrudModal'
import { useFilterModal } from '@/composables/useFilterModal'
import { usePagination } from '@/composables/usePagination'
import { usePermissions } from '@/composables/usePermissions'
import { useRecordDeletion } from '@/composables/useRecordDeletion'
import { useTableSort } from '@/composables/useTableSort'
import { LIMITES_TEXTO } from '@/lib/limits'
import type { Category } from '@/types'

const { canManage } = usePermissions()

const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadCategories), 'name')

const categories = ref<Category[]>([])
const { selectedIds, allVisibleSelected, toggleOne, toggleAllVisible, clearSelection } = useBulkSelection(() =>
  categories.value.map(({ id }) => id),
)
const { loading, errorMessage, withLoading } = useAsyncState()

const search = ref('')
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  () => ({ active: 'todos' }),
  () => reload(loadCategories),
)
const activeFilterCount = computed(() => Number(filters.value.active !== 'todos'))
const statusFilterOptions = statusFilterOptionsFor('f')

async function loadCategories() {
  await withLoading(async () => {
    const result = await listCategories({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      active: filters.value.active === 'todos' ? undefined : filters.value.active === 'true',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    categories.value = result.data
    clearSelection()
    applyMeta(result)
  })
}

const { modalOpen, editingId, saving, form, fieldErrors, openCreateModal, openEditModal, handleSubmit } = useCrudModal<
  Required<CategoryInput>,
  Category
>({
  emptyForm: () => ({ name: '', description: '', active: true }),
  toForm: (category) => ({
    name: category.name,
    description: category.description ?? '',
    active: category.active,
  }),
  create: (values) => createCategory(values),
  update: (id, values) => updateCategory(id, values),
  reload: loadCategories,
  createdMessage: 'Categoria criada com sucesso',
  updatedMessage: 'Categoria atualizada com sucesso',
  saveErrorMessage: 'Não foi possível salvar a categoria',
  validate,
})

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.value.name.trim()) fieldErrors.value.name = 'Informe o nome da categoria'
  return Object.keys(fieldErrors.value).length === 0
}

const { deletingSelected, handleDelete, handleBulkDelete } = useRecordDeletion<Category>({
  singular: 'categoria',
  plural: 'categorias',
  genero: 'f',
  remove: deleteCategory,
  removeMany: deleteCategories,
  selectedIds,
  reload: loadCategories,
})

watchSearch(search, loadCategories)
onMounted(loadCategories)
</script>

<template>
  <div>
    <PageHeader title="Categorias" subtitle="Organize seus produtos por categoria">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por nome..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <BaseButton v-if="canManage" class="!px-2.5 sm:!px-4" title="Nova categoria" aria-label="Nova categoria" @click="openCreateModal">
          <Plus :size="16" /> <span class="hidden sm:inline">Nova categoria</span>
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
                label="Selecionar todas as categorias desta página"
                @toggle="toggleAllVisible"
              />
            </th>
            <SortableTableHeader field="name" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Nome</SortableTableHeader>
            <SortableTableHeader field="description" :active-field="sortBy" :order="sortOrder" class="hidden sm:table-cell" @sort="toggleSort">Descrição</SortableTableHeader>
            <SortableTableHeader field="active" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Situação</SortableTableHeader>
            <th v-if="canManage" data-actions class="print:hidden px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td :colspan="canManage ? 5 : 3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="categories.length === 0">
            <td :colspan="canManage ? 5 : 3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma categoria cadastrada.
            </td>
          </tr>
          <tr
            v-for="category in categories"
            v-else
            :key="category.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-700/40"
            :class="canManage ? 'cursor-pointer' : ''"
            :title="canManage ? 'Duplo clique para editar' : ''"
            @dblclick="canManage && openEditModal(category)"
          >
            <td v-if="canManage" class="print:hidden px-4 py-3" @dblclick.stop @click.stop>
              <TableCheckbox
                :checked="selectedIds.includes(category.id)"
                :label="`Selecionar categoria ${category.name}`"
                @toggle="toggleOne(category.id)"
              />
            </td>
            <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="category.name" :max-length="45" />
            </td>
            <td class="max-w-80 px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
              <ExpandableText :text="category.description" />
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <StatusBadge :active="category.active" genero="f" />
            </td>
            <td v-if="canManage" class="print:hidden px-4 py-3 text-right space-x-1 whitespace-nowrap" @dblclick.stop>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Editar"
                @click="openEditModal(category)"
              >
                <Pencil :size="16" />
              </button>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                title="Excluir"
                @click="handleDelete(category)"
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
      title="Filtrar categorias"
      @close="filterModalOpen = false"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseSelect v-model="draftFilters.active" label="Situação" :options="statusFilterOptions" />
    </FilterModal>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar categoria' : 'Nova categoria'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput
          v-model="form.name"
          label="Nome"
          :maxlength="LIMITES_TEXTO.nome"
          :error="fieldErrors.name"
          required
        />
        <BaseInput
          v-model="form.description"
          label="Descrição"
          :maxlength="LIMITES_TEXTO.descricao"
          :error="fieldErrors.description"
        />
        <BaseToggle v-model="form.active" label="Categoria ativa" />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Categoria inativa continua valendo para os produtos que já usam ela, e deixa de aparecer na hora de
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
