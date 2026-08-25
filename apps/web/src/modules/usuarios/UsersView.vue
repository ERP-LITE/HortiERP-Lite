<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2, Wand2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import FilterModal from '@/components/ui/FilterModal.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import BulkSelectionBar from '@/components/ui/BulkSelectionBar.vue'
import TableCheckbox from '@/components/ui/TableCheckbox.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import { generateRandomPassword } from '@/lib/password'
import { statusFilterOptionsFor } from '@/lib/status'
import { createUser, deleteUser, deleteUsers, listUsers, updateUser } from '@/services/usersService'
import { usePagination } from '@/composables/usePagination'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { useFilterModal } from '@/composables/useFilterModal'
import { useTableSort } from '@/composables/useTableSort'
import type { User, UserRole } from '@/types'

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'operador', label: 'Operador' },
]
const roleFilterOptions = [{ value: 'todos', label: 'Todos os perfis' }, ...roleOptions]
const statusFilterOptions = statusFilterOptionsFor()

const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadUsers), 'name')

const users = ref<User[]>([])
const { selectedIds, allVisibleSelected, toggleOne, toggleAllVisible, clearSelection } = useBulkSelection(() =>
  users.value.map(({ id }) => id),
)
const deletingSelected = ref(false)
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  () => ({ role: 'todos', active: 'todos' }),
  () => reload(loadUsers),
)
const activeFilterCount = computed(
  () => Number(filters.value.role !== 'todos') + Number(filters.value.active !== 'todos'),
)

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

const emptyForm = { name: '', email: '', password: '', role: 'operador' as UserRole, active: true }
const form = ref({ ...emptyForm })
const passwordConfirm = ref('')

async function loadUsers() {
  loading.value = true
  try {
    const result = await listUsers({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      role: filters.value.role !== 'todos' ? (filters.value.role as UserRole) : undefined,
      active: filters.value.active === 'todos' ? undefined : filters.value.active === 'true',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    users.value = result.data
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
  form.value = { ...emptyForm }
  passwordConfirm.value = ''
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEditModal(user: User) {
  editingId.value = user.id
  form.value = { name: user.name, email: user.email, password: '', role: user.role, active: user.active }
  passwordConfirm.value = ''
  fieldErrors.value = {}
  modalOpen.value = true
}

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.value.name.trim()) fieldErrors.value.name = 'Informe o nome'
  if (!form.value.email.trim()) fieldErrors.value.email = 'Informe o e-mail'
  if (!editingId.value && !form.value.password.trim()) fieldErrors.value.password = 'Informe a senha'
  else if (form.value.password && form.value.password !== passwordConfirm.value) {
    fieldErrors.value.passwordConfirm = 'A confirmação não confere com a senha'
  }
  return Object.keys(fieldErrors.value).length === 0
}

async function handleGeneratePassword() {
  const password = generateRandomPassword()
  form.value.password = password
  passwordConfirm.value = password
  delete fieldErrors.value.password
  delete fieldErrors.value.passwordConfirm

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
    if (result.message) toastError(result.message)
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

async function handleBulkDelete() {
  const count = selectedIds.value.length
  const confirmed = await confirmDelete({
    title: `Excluir ${count} ${count === 1 ? 'usuário selecionado' : 'usuários selecionados'}?`,
    text: 'Os registros serão excluídos logicamente e os acessos serão desativados.',
  })
  if (!confirmed) return

  deletingSelected.value = true
  try {
    const result = await deleteUsers(selectedIds.value)
    await loadUsers()
    toastSuccess(`${result.deleted} ${result.deleted === 1 ? 'usuário excluído' : 'usuários excluídos'} com sucesso`)
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível excluir os usuários selecionados'))
  } finally {
    deletingSelected.value = false
  }
}

watchSearch(search, loadUsers)
onMounted(loadUsers)
</script>

<template>
  <div>
    <PageHeader title="Usuários" subtitle="Gerencie os acessos ao sistema">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por nome ou e-mail..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <BaseButton class="!px-2.5 sm:!px-4" title="Novo usuário" aria-label="Novo usuário" @click="openCreateModal">
          <Plus :size="16" /> <span class="hidden sm:inline">Novo usuário</span>
        </BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <BulkSelectionBar
      :count="selectedIds.length"
      :deleting="deletingSelected"
      @clear="clearSelection"
      @delete="handleBulkDelete"
    />

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th class="print:hidden w-12 px-4 py-3">
              <TableCheckbox
                :checked="allVisibleSelected"
                label="Selecionar todos os usuários desta página"
                @toggle="toggleAllVisible"
              />
            </th>
            <SortableTableHeader field="name" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Nome</SortableTableHeader>
            <SortableTableHeader field="email" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">E-mail</SortableTableHeader>
            <SortableTableHeader field="role" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Perfil</SortableTableHeader>
            <SortableTableHeader field="active" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Situação</SortableTableHeader>
            <th data-actions class="print:hidden px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="users.length === 0">
            <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
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
            <td class="print:hidden px-4 py-3" @dblclick.stop @click.stop>
              <TableCheckbox
                :checked="selectedIds.includes(user.id)"
                :label="`Selecionar usuário ${user.name}`"
                @toggle="toggleOne(user.id)"
              />
            </td>
            <td class="max-w-64 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="user.name" :max-length="40" />
            </td>
            <td class="max-w-72 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="user.email" :max-length="45" />
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">
              {{ user.role }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <StatusBadge :active="user.active" />
            </td>
            <td class="print:hidden px-4 py-3 text-right space-x-1 whitespace-nowrap" @dblclick.stop>
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
      <Pagination v-bind="paginationProps" />
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar usuário' : 'Novo usuário'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="form.name" label="Nome" :error="fieldErrors.name" required />
        <BaseInput v-model="form.email" type="email" label="E-mail" :error="fieldErrors.email" required />
        <div>
          <BaseInput
            v-model="form.password"
            type="password"
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
          :label="editingId ? 'Confirmar nova senha' : 'Confirmar senha'"
          :error="fieldErrors.passwordConfirm"
          :required="!editingId"
        />
        <BaseSelect v-model="form.role" label="Perfil" :options="roleOptions" required />

        <BaseToggle v-model="form.active" label="Usuário ativo" />

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <FilterModal
      :open="filterModalOpen"
      title="Filtrar usuários"
      @close="filterModalOpen = false"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseSelect v-model="draftFilters.role" label="Perfil" :options="roleFilterOptions" />
      <BaseSelect v-model="draftFilters.active" label="Situação" :options="statusFilterOptions" />
    </FilterModal>
  </div>
</template>
