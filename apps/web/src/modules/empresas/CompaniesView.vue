<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Pencil, Plus, Wand2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import Pagination from '@/components/ui/Pagination.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { toastError, toastSuccess } from '@/lib/alerts'
import { generateRandomPassword } from '@/lib/password'
import {
  createCompany,
  listCompanies,
  setCompanyActive,
  updateCompany,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from '@/services/companiesService'
import { usePagination } from '@/composables/usePagination'
import type { Company } from '@/types'
import PlatformUsersPanel from './PlatformUsersPanel.vue'

const { page, pageSize, total, totalPages, applyMeta, watchSearch } = usePagination()

const companies = ref<Company[]>([])
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

const emptyCreateForm: CreateCompanyInput = {
  name: '',
  document: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
}
const createForm = ref<CreateCompanyInput>({ ...emptyCreateForm })
const editForm = ref<UpdateCompanyInput>({ name: '', document: '' })

async function loadCompanies() {
  loading.value = true
  try {
    const result = await listCompanies({ page: page.value, pageSize: pageSize.value, search: search.value || undefined })
    companies.value = result.data
    applyMeta(result)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  editingId.value = null
  createForm.value = { ...emptyCreateForm }
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEditModal(company: Company) {
  editingId.value = company.id
  editForm.value = { name: company.name, document: company.document ?? '' }
  fieldErrors.value = {}
  modalOpen.value = true
}

function validateCreate(): boolean {
  fieldErrors.value = {}
  if (!createForm.value.name.trim()) fieldErrors.value.name = 'Informe o nome da empresa'
  if (!createForm.value.adminName.trim()) fieldErrors.value.adminName = 'Informe o nome do administrador'
  if (!createForm.value.adminEmail.trim()) fieldErrors.value.adminEmail = 'Informe o e-mail do administrador'
  if (!createForm.value.adminPassword.trim() || createForm.value.adminPassword.length < 8) {
    fieldErrors.value.adminPassword = 'A senha deve ter ao menos 8 caracteres'
  }
  return Object.keys(fieldErrors.value).length === 0
}

async function handleGeneratePassword() {
  const password = generateRandomPassword()
  createForm.value.adminPassword = password

  try {
    await navigator.clipboard.writeText(password)
    toastSuccess('Senha gerada e copiada para a área de transferência')
  } catch {
    toastSuccess('Senha gerada')
  }
}

async function handleSubmit() {
  saving.value = true
  try {
    if (editingId.value) {
      await updateCompany(editingId.value, editForm.value)
      toastSuccess('Empresa atualizada com sucesso')
    } else {
      if (!validateCreate()) {
        saving.value = false
        return
      }
      const result = await createCompany(createForm.value)
      toastSuccess(`Empresa criada. Login do admin: ${result.admin.email}`)
    }
    modalOpen.value = false
    await loadCompanies()
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível salvar a empresa')
    fieldErrors.value = result.fieldErrors
    errorMessage.value = result.message
  } finally {
    saving.value = false
  }
}

async function handleToggleActive(company: Company, active: boolean) {
  try {
    await setCompanyActive(company.id, active)
    await loadCompanies()
    toastSuccess(active ? 'Empresa reativada' : 'Empresa suspensa')
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível alterar o status da empresa'))
  }
}

watchSearch(search, loadCompanies)
onMounted(loadCompanies)
</script>

<template>
  <div>
    <PageHeader title="Empresas" subtitle="Cadastre e gerencie as empresas-cliente do sistema">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por nome ou documento..." />
        <BaseButton class="!px-2.5 sm:!px-4" title="Nova empresa" aria-label="Nova empresa" @click="openCreateModal">
          <Plus :size="16" /> <span class="hidden sm:inline">Nova empresa</span>
        </BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Documento
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="companies.length === 0">
            <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma empresa cadastrada.
            </td>
          </tr>
          <tr
            v-for="company in companies"
            v-else
            :key="company.id"
            class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
            title="Duplo clique para editar"
            @dblclick="openEditModal(company)"
          >
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
              {{ company.name }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ company.document || '—' }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap" @dblclick.stop @click.stop>
              <div class="flex items-center gap-2">
                <BaseBadge :variant="company.active ? 'success' : 'neutral'">
                  {{ company.active ? 'Ativo' : 'Suspenso' }}
                </BaseBadge>
                <BaseToggle
                  :model-value="company.active"
                  @update:model-value="(value) => handleToggleActive(company, value)"
                />
              </div>
            </td>
            <td class="px-4 py-3 text-right whitespace-nowrap" @dblclick.stop>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Editar"
                @click="openEditModal(company)"
              >
                <Pencil :size="16" />
              </button>
            </td>
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

    <PlatformUsersPanel />

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar empresa' : 'Nova empresa'" @close="modalOpen = false">
      <form v-if="editingId" class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="editForm.name" label="Nome da empresa" :error="fieldErrors.name" />
        <BaseInput v-model="editForm.document" label="Documento" :error="fieldErrors.document" />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
      <form v-else class="space-y-4" @submit.prevent="handleSubmit">
        <BaseInput v-model="createForm.name" label="Nome da empresa" :error="fieldErrors.name" />
        <BaseInput v-model="createForm.document" label="Documento (opcional)" :error="fieldErrors.document" />
        <hr class="border-gray-200 dark:border-gray-700" />
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Administrador da empresa</p>
        <BaseInput v-model="createForm.adminName" label="Nome" :error="fieldErrors.adminName" />
        <BaseInput v-model="createForm.adminEmail" type="email" label="E-mail" :error="fieldErrors.adminEmail" />
        <div>
          <BaseInput
            v-model="createForm.adminPassword"
            type="password"
            label="Senha"
            :error="fieldErrors.adminPassword"
          />
          <button
            type="button"
            class="mt-1.5 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
            @click="handleGeneratePassword"
          >
            <Wand2 :size="12" /> Gerar senha aleatória
          </button>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
