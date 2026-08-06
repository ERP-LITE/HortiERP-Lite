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
import ExpandableText from '@/components/ui/ExpandableText.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import {
  createCategory,
  deleteCategories,
  deleteCategory,
  listCategories,
  updateCategory,
  type CategoryInput,
} from '@/services/categoriesService'
import { useAuthStore } from '@/stores/auth'
import { usePagination } from '@/composables/usePagination'
import { useBulkSelection } from '@/composables/useBulkSelection'
import type { Category } from '@/types'

const auth = useAuthStore()
const canManage = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'gerente')

const { page, pageSize, total, totalPages, applyMeta, watchSearch } = usePagination()

const categories = ref<Category[]>([])
const { selectedIds, allVisibleSelected, toggleOne, toggleAllVisible, clearSelection } = useBulkSelection(() =>
  categories.value.map(({ id }) => id),
)
const deletingSelected = ref(false)
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref<CategoryInput>({ name: '', description: '' })
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

async function loadCategories() {
  loading.value = true
  try {
    const result = await listCategories({ page: page.value, pageSize: pageSize.value, search: search.value || undefined })
    categories.value = result.data
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
  form.value = { name: '', description: '' }
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEditModal(category: Category) {
  editingId.value = category.id
  form.value = { name: category.name, description: category.description ?? '' }
  fieldErrors.value = {}
  modalOpen.value = true
}

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.value.name.trim()) fieldErrors.value.name = 'Informe o nome da categoria'
  return Object.keys(fieldErrors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    if (editingId.value) {
      await updateCategory(editingId.value, form.value)
      toastSuccess('Categoria atualizada com sucesso')
    } else {
      await createCategory(form.value)
      toastSuccess('Categoria criada com sucesso')
    }
    modalOpen.value = false
    await loadCategories()
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível salvar a categoria')
    fieldErrors.value = result.fieldErrors
    errorMessage.value = result.message
  } finally {
    saving.value = false
  }
}

async function handleDelete(category: Category) {
  const confirmed = await confirmDelete({
    title: `Excluir a categoria "${category.name}"?`,
    text: 'Essa ação não pode ser desfeita.',
  })
  if (!confirmed) return

  try {
    await deleteCategory(category.id)
    await loadCategories()
    toastSuccess('Categoria excluída com sucesso')
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível excluir a categoria'))
  }
}

async function handleBulkDelete() {
  const count = selectedIds.value.length
  const confirmed = await confirmDelete({
    title: `Excluir ${count} ${count === 1 ? 'categoria selecionada' : 'categorias selecionadas'}?`,
    text: 'Os registros serão excluídos logicamente e deixarão de aparecer no sistema.',
  })
  if (!confirmed) return

  deletingSelected.value = true
  try {
    const result = await deleteCategories(selectedIds.value)
    await loadCategories()
    toastSuccess(`${result.deleted} ${result.deleted === 1 ? 'categoria excluída' : 'categorias excluídas'} com sucesso`)
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível excluir as categorias selecionadas'))
  } finally {
    deletingSelected.value = false
  }
}

watchSearch(search, loadCategories)
onMounted(loadCategories)
</script>

<template>
  <div>
    <PageHeader title="Categorias" subtitle="Organize seus produtos por categoria">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por nome..." />
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
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell"
            >
              Descrição
            </th>
            <th class="print:hidden px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td :colspan="canManage ? 4 : 3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="categories.length === 0">
            <td :colspan="canManage ? 4 : 3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
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

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar categoria' : 'Nova categoria'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="form.name" label="Nome" :error="fieldErrors.name" />
        <BaseInput v-model="form.description" label="Descrição" />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
