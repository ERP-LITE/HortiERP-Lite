<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { getApiErrorMessage } from '@/services/api'
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
  modalOpen.value = true
}

function openEditModal(category: Category) {
  editingId.value = category.id
  form.value = { name: category.name, description: category.description ?? '' }
  modalOpen.value = true
}

async function handleSubmit() {
  saving.value = true
  try {
    if (editingId.value) {
      await updateCategory(editingId.value, form.value)
    } else {
      await createCategory(form.value)
    }
    modalOpen.value = false
    await loadCategories()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível salvar a categoria')
  } finally {
    saving.value = false
  }
}

async function handleDelete(category: Category) {
  if (!confirm(`Excluir a categoria "${category.name}"?`)) return

  try {
    await deleteCategory(category.id)
    await loadCategories()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível excluir a categoria')
  }
}

onMounted(loadCategories)
</script>

<template>
  <div>
    <PageHeader title="Categorias" subtitle="Organize seus produtos por categoria">
      <template #actions>
        <BaseButton @click="openCreateModal">+ Nova categoria</BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 mb-4">{{ errorMessage }}</p>

    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
              Descrição
            </th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500">Carregando...</td>
          </tr>
          <tr v-else-if="categories.length === 0">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500">
              Nenhuma categoria cadastrada.
            </td>
          </tr>
          <tr v-for="category in categories" v-else :key="category.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ category.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
              {{ category.description || '—' }}
            </td>
            <td class="px-4 py-3 text-right space-x-2 whitespace-nowrap">
              <button class="text-sm text-primary-600 hover:underline" @click="openEditModal(category)">
                Editar
              </button>
              <button class="text-sm text-red-600 hover:underline" @click="handleDelete(category)">
                Excluir
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar categoria' : 'Nova categoria'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="form.name" label="Nome" required />
        <BaseInput v-model="form.description" label="Descrição" />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
