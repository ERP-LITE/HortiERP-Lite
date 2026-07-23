<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { getApiErrorMessage } from '@/services/api'
import { createUser, deleteUser, listUsers, updateUser } from '@/services/usersService'
import type { User, UserRole } from '@/types'

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'operador', label: 'Operador' },
]

const users = ref<User[]>([])
const loading = ref(true)
const errorMessage = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const emptyForm = { name: '', email: '', password: '', role: 'operador' as UserRole, active: true }
const form = ref({ ...emptyForm })

async function loadUsers() {
  loading.value = true
  try {
    users.value = await listUsers()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  editingId.value = null
  form.value = { ...emptyForm }
  modalOpen.value = true
}

function openEditModal(user: User) {
  editingId.value = user.id
  form.value = { name: user.name, email: user.email, password: '', role: user.role, active: user.active }
  modalOpen.value = true
}

async function handleSubmit() {
  saving.value = true
  try {
    if (editingId.value) {
      const payload = { ...form.value, password: form.value.password || undefined }
      await updateUser(editingId.value, payload)
    } else {
      await createUser(form.value)
    }
    modalOpen.value = false
    await loadUsers()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível salvar o usuário')
  } finally {
    saving.value = false
  }
}

async function handleDelete(user: User) {
  if (!confirm(`Excluir o usuário "${user.name}"?`)) return

  try {
    await deleteUser(user.id)
    await loadUsers()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível excluir o usuário')
  }
}

onMounted(loadUsers)
</script>

<template>
  <div>
    <PageHeader title="Usuários" subtitle="Gerencie os acessos ao sistema">
      <template #actions>
        <BaseButton @click="openCreateModal"><Plus :size="16" /> Novo usuário</BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              E-mail
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Perfil
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Status
            </th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="users.length === 0">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum usuário cadastrado.
            </td>
          </tr>
          <tr v-for="user in users" v-else :key="user.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
              {{ user.name }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ user.email }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">
              {{ user.role }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge :variant="user.active ? 'success' : 'neutral'">
                {{ user.active ? 'Ativo' : 'Inativo' }}
              </BaseBadge>
            </td>
            <td class="px-4 py-3 text-right space-x-3 whitespace-nowrap">
              <button
                class="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline dark:text-primary-400"
                @click="openEditModal(user)"
              >
                <Pencil :size="14" /> Editar
              </button>
              <button
                class="inline-flex items-center gap-1 text-sm text-red-600 hover:underline dark:text-red-400"
                @click="handleDelete(user)"
              >
                <Trash2 :size="14" /> Excluir
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar usuário' : 'Novo usuário'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="form.name" label="Nome" required />
        <BaseInput v-model="form.email" type="email" label="E-mail" required />
        <BaseInput
          v-model="form.password"
          type="password"
          :label="editingId ? 'Nova senha (opcional)' : 'Senha'"
          :required="!editingId"
        />
        <BaseSelect v-model="form.role" label="Perfil" :options="roleOptions" required />

        <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            v-model="form.active"
            type="checkbox"
            class="rounded border-gray-300 text-primary-600 dark:border-gray-600 dark:bg-gray-800"
          />
          Usuário ativo
        </label>

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
