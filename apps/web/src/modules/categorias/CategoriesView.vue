<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { getApiErrorMessage, getApiFieldErrors } from '@/services/api'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type CategoryInput,
} from '@/services/categoriesService'
import type { Category } from '@/types'

const categories = ref<Category[]>([])
const loading = ref(true)
const errorMessage = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref<CategoryInput>({ name: '', description: '' })
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

async function loadCategories() {
  loading.value = true
  try {
    categories.value = await listCategories()
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
    const apiFieldErrors = getApiFieldErrors(error)
    if (Object.keys(apiFieldErrors).length > 0) {
      fieldErrors.value = apiFieldErrors
    } else {
      errorMessage.value = getApiErrorMessage(error, 'Não foi possível salvar a categoria')
    }
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

onMounted(loadCategories)
</script>

<template>
  <div>
    <PageHeader title="Categorias" subtitle="Organize seus produtos por categoria">
      <template #actions>
        <BaseButton @click="openCreateModal"><Plus :size="16" /> Nova categoria</BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell"
            >
              Descrição
            </th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="categories.length === 0">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma categoria cadastrada.
            </td>
          </tr>
          <tr v-for="category in categories" v-else :key="category.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ category.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
              {{ category.description || '—' }}
            </td>
            <td class="px-4 py-3 text-right space-x-1 whitespace-nowrap">
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
