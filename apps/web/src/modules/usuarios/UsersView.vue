<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2, Wand2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import { generateRandomPassword } from '@/lib/password'
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
const fieldErrors = ref<Record<string, string>>({})

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
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEditModal(user: User) {
  editingId.value = user.id
  form.value = { name: user.name, email: user.email, password: '', role: user.role, active: user.active }
  fieldErrors.value = {}
  modalOpen.value = true
}

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.value.name.trim()) fieldErrors.value.name = 'Informe o nome'
  if (!form.value.email.trim()) fieldErrors.value.email = 'Informe o e-mail'
  if (!editingId.value && !form.value.password.trim()) fieldErrors.value.password = 'Informe a senha'
  return Object.keys(fieldErrors.value).length === 0
}

async function handleGeneratePassword() {
  const password = generateRandomPassword()
  form.value.password = password

  try {
    await navigator.clipboard.writeText(password)
    toastSuccess('Senha gerada e copiada para a área de transferência')
  } catch {
    toastSuccess('Senha gerada')
  }
}

async function handleSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    if (editingId.value) {
      const payload = { ...form.value, password: form.value.password || undefined }
      await updateUser(editingId.value, payload)
      toastSuccess('Usuário atualizado com sucesso')
    } else {
      await createUser(form.value)
      toastSuccess('Usuário criado com sucesso')
    }
    modalOpen.value = false
    await loadUsers()
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível salvar o usuário')
    fieldErrors.value = result.fieldErrors
    errorMessage.value = result.message
  } finally {
    saving.value = false
  }
}

async function handleDelete(user: User) {
  const confirmed = await confirmDelete({
    title: `Excluir o usuário "${user.name}"?`,
    text: 'Essa ação não pode ser desfeita.',
  })
  if (!confirmed) return

  try {
    await deleteUser(user.id)
    await loadUsers()
    toastSuccess('Usuário excluído com sucesso')
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível excluir o usuário'))
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
          <tr
            v-for="user in users"
            v-else
            :key="user.id"
            class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
            title="Duplo clique para editar"
            @dblclick="openEditModal(user)"
          >
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
            <td class="px-4 py-3 text-right space-x-1 whitespace-nowrap" @dblclick.stop>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Editar"
                @click="openEditModal(user)"
              >
                <Pencil :size="16" />
              </button>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                title="Excluir"
                @click="handleDelete(user)"
              >
                <Trash2 :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar usuário' : 'Novo usuário'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="form.name" label="Nome" :error="fieldErrors.name" />
        <BaseInput v-model="form.email" type="email" label="E-mail" :error="fieldErrors.email" />
        <div>
          <BaseInput
            v-model="form.password"
            type="password"
            :label="editingId ? 'Nova senha (opcional)' : 'Senha'"
            :error="fieldErrors.password"
          />
          <button
            type="button"
            class="mt-1.5 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
            @click="handleGeneratePassword"
          >
            <Wand2 :size="12" /> Gerar senha aleatória
          </button>
        </div>
        <BaseSelect v-model="form.role" label="Perfil" :options="roleOptions" required />

        <BaseToggle v-model="form.active" label="Usuário ativo" />

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
