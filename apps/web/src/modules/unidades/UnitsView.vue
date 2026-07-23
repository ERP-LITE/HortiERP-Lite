<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { getApiErrorMessage } from '@/services/api'
import { createUnit, deleteUnit, listUnits, updateUnit, type UnitInput } from '@/services/unitsService'
import type { Unit } from '@/types'

const units = ref<Unit[]>([])
const loading = ref(true)
const errorMessage = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref<UnitInput>({ name: '', abbreviation: '' })
const saving = ref(false)

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
  modalOpen.value = true
}

function openEditModal(unit: Unit) {
  editingId.value = unit.id
  form.value = { name: unit.name, abbreviation: unit.abbreviation }
  modalOpen.value = true
}

async function handleSubmit() {
  saving.value = true
  try {
    if (editingId.value) {
      await updateUnit(editingId.value, form.value)
    } else {
      await createUnit(form.value)
    }
    modalOpen.value = false
    await loadUnits()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível salvar a unidade')
  } finally {
    saving.value = false
  }
}

async function handleDelete(unit: Unit) {
  if (!confirm(`Excluir a unidade "${unit.name}"?`)) return

  try {
    await deleteUnit(unit.id)
    await loadUnits()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível excluir a unidade')
  }
}

onMounted(loadUnits)
</script>

<template>
  <div>
    <PageHeader title="Unidades de medida" subtitle="Ex.: quilograma, unidade, dúzia, caixa">
      <template #actions>
        <BaseButton @click="openCreateModal">+ Nova unidade</BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 mb-4">{{ errorMessage }}</p>

    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Abreviação</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500">Carregando...</td>
          </tr>
          <tr v-else-if="units.length === 0">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500">Nenhuma unidade cadastrada.</td>
          </tr>
          <tr v-for="unit in units" v-else :key="unit.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ unit.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ unit.abbreviation }}</td>
            <td class="px-4 py-3 text-right space-x-2 whitespace-nowrap">
              <button class="text-sm text-primary-600 hover:underline" @click="openEditModal(unit)">Editar</button>
              <button class="text-sm text-red-600 hover:underline" @click="handleDelete(unit)">Excluir</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar unidade' : 'Nova unidade'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="form.name" label="Nome" required />
        <BaseInput v-model="form.abbreviation" label="Abreviação" required />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
