<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { getApiErrorMessage, getApiFieldErrors } from '@/services/api'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import { createUnit, deleteUnit, listUnits, updateUnit, type UnitInput } from '@/services/unitsService'
import type { Unit } from '@/types'

const units = ref<Unit[]>([])
const loading = ref(true)
const errorMessage = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref<UnitInput>({ name: '', abbreviation: '' })
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

async function loadUnits() {
  loading.value = true
  try {
    units.value = await listUnits()
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
    const apiFieldErrors = getApiFieldErrors(error)
    if (Object.keys(apiFieldErrors).length > 0) {
      fieldErrors.value = apiFieldErrors
    } else {
      errorMessage.value = getApiErrorMessage(error, 'Não foi possível salvar a unidade')
    }
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

onMounted(loadUnits)
</script>

<template>
  <div>
    <PageHeader title="Unidades de medida" subtitle="Ex.: quilograma, unidade, dúzia, caixa">
      <template #actions>
        <BaseButton @click="openCreateModal"><Plus :size="16" /> Nova unidade</BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Abreviação
            </th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="units.length === 0">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma unidade cadastrada.
            </td>
          </tr>
          <tr v-for="unit in units" v-else :key="unit.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ unit.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ unit.abbreviation }}</td>
            <td class="px-4 py-3 text-right space-x-1 whitespace-nowrap">
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
