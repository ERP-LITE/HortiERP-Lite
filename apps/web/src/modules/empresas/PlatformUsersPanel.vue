<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2, Wand2 } from '@lucide/vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import Pagination from '@/components/ui/Pagination.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { useCrudModal } from '@/composables/useCrudModal'
import { useGeneratedPassword } from '@/composables/useGeneratedPassword'
import { usePagination } from '@/composables/usePagination'
import { useRecordDeletion } from '@/composables/useRecordDeletion'
import { useTableSort } from '@/composables/useTableSort'
import {
  createPlatformUser,
  deletePlatformUser,
  listPlatformUsers,
  updatePlatformUser,
} from '@/services/platformUsersService'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types'
import { LIMITES_TEXTO } from '@/lib/limits'

const auth = useAuthStore()
const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadUsers), 'name')
const users = ref<User[]>([])
const search = ref('')
const { loading, errorMessage, withLoading } = useAsyncState()
const passwordConfirm = ref('')

async function loadUsers() {
  await withLoading(async () => {
    const result = await listPlatformUsers({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    users.value = result.data
    applyMeta(result)
  })
}

interface PlatformUserForm {
  name: string
  email: string
  password: string
}

const { modalOpen, editingId, saving, form, fieldErrors, clearFieldErrors, openCreateModal, openEditModal, handleSubmit } =
  useCrudModal<PlatformUserForm, User>({
    emptyForm: () => ({ name: '', email: '', password: '' }),
    toForm: (user) => ({ name: user.name, email: user.email, password: '' }),
    create: (values) => createPlatformUser(values),
    update: (id, values) => updatePlatformUser(id, { ...values, password: values.password || undefined }),
    reload: loadUsers,
    createdMessage: 'Super administrador criado com sucesso',
    updatedMessage: 'Super administrador atualizado com sucesso',
    saveErrorMessage: 'Não foi possível salvar o super administrador',
    validate,
    onOpen: () => {
      passwordConfirm.value = ''
    },
  })

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.value.name.trim()) fieldErrors.value.name = 'Informe o nome'
  if (!form.value.email.trim()) fieldErrors.value.email = 'Informe o e-mail'
  if (!editingId.value && form.value.password.length < 8) {
    fieldErrors.value.password = 'A senha deve ter ao menos 8 caracteres'
  } else if (form.value.password && form.value.password.length < 8) {
    fieldErrors.value.password = 'A senha deve ter ao menos 8 caracteres'
  } else if (form.value.password && form.value.password !== passwordConfirm.value) {
    fieldErrors.value.passwordConfirm = 'A confirmação não confere com a senha'
  }
  return Object.keys(fieldErrors.value).length === 0
}

const { generatePassword: handleGeneratePassword } = useGeneratedPassword((password) => {
  form.value.password = password
  passwordConfirm.value = password
  clearFieldErrors('password', 'passwordConfirm')
})

const { handleDelete } = useRecordDeletion<User>({
  singular: 'super administrador',
  plural: 'super administradores',
  remove: deletePlatformUser,
  reload: loadUsers,
  confirmText: 'O acesso deste usuário será removido.',
})

watchSearch(search, loadUsers)
onMounted(loadUsers)
</script>

<template>
  <section class="mt-8">
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Super administradores</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">Gerencie os usuários com acesso geral à plataforma.</p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row">
        <SearchInput v-model="search" placeholder="Buscar por nome ou e-mail..." />
        <BaseButton
          class="!px-2.5 sm:!px-4"
          title="Novo super administrador"
          aria-label="Novo super administrador"
          @click="openCreateModal"
        >
          <Plus :size="16" /> <span class="hidden sm:inline">Novo super administrador</span>
        </BaseButton>
      </div>
    </div>

    <p v-if="errorMessage" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

    <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <SortableTableHeader field="name" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Nome</SortableTableHeader>
            <SortableTableHeader field="email" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">E-mail</SortableTableHeader>
            <th data-actions class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="users.length === 0">
            <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum super administrador cadastrado.
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
            <td class="max-w-64 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="user.name" :max-length="40" />
              <span v-if="user.id === auth.user?.id" class="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">(você)</span>
            </td>
            <td class="max-w-72 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="user.email" :max-length="45" />
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right space-x-1" @dblclick.stop>
              <button
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Editar"
                @click="openEditModal(user)"
              >
                <Pencil :size="16" />
              </button>
              <button
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35 dark:text-red-400 dark:hover:bg-red-900/30"
                title="Excluir"
                :disabled="user.id === auth.user?.id"
                @click="handleDelete(user)"
              >
                <Trash2 :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-bind="paginationProps" />
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar super administrador' : 'Novo super administrador'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput
          v-model="form.name"
          label="Nome"
          :maxlength="LIMITES_TEXTO.nome"
          :error="fieldErrors.name"
          required
        />
        <BaseInput
          v-model="form.email"
          type="email"
          label="E-mail"
          :maxlength="LIMITES_TEXTO.email"
          :error="fieldErrors.email"
          required
        />
        <div>
          <BaseInput
            v-model="form.password"
            type="password"
            :maxlength="LIMITES_TEXTO.senha"
            :label="editingId ? 'Nova senha (opcional)' : 'Senha'"
            :error="fieldErrors.password"
            :required="!editingId"
          />
          <button
            type="button"
            class="mt-1.5 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
            @click="handleGeneratePassword"
          >
            <Wand2 :size="12" /> Gerar senha aleatória
          </button>
        </div>
        <BaseInput
          v-model="passwordConfirm"
          type="password"
          :maxlength="LIMITES_TEXTO.senha"
          :label="editingId ? 'Confirmar nova senha' : 'Confirmar senha'"
          :error="fieldErrors.passwordConfirm"
          :required="!editingId"
        />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </section>
</template>
