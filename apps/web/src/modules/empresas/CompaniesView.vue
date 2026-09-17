<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Building2, MapPin, Pencil, Plus, UserCog, Wand2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import Pagination from '@/components/ui/Pagination.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import FormTabs, { type FormTab } from '@/components/ui/FormTabs.vue'
import CompanyFormFields from '@/components/empresa/CompanyFormFields.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { getApiErrorMessage } from '@/services/api'
import { toastError, toastSuccess } from '@/lib/alerts'
import { formatCnpj, formatPhone } from '@/lib/format'
import {
  CAMPOS_DA_ABA_ENDERECO,
  CAMPOS_DA_ABA_GERAL,
  emptyAdminForm,
  emptyCompanyForm,
  primeiraAbaComErro,
  validateAdminFields,
  validateCompanyFields,
} from '@/lib/companyForm'
import {
  createCompany,
  listCompanies,
  setCompanyActive,
  updateCompany,
  type CompanyDetailsInput,
} from '@/services/companiesService'
import { useAsyncState } from '@/composables/useAsyncState'
import { useCepLookup } from '@/composables/useCepLookup'
import { useCrudModal } from '@/composables/useCrudModal'
import { useGeneratedPassword } from '@/composables/useGeneratedPassword'
import { usePagination } from '@/composables/usePagination'
import { useTableSort } from '@/composables/useTableSort'
import type { Company } from '@/types'
import PlatformUsersPanel from './PlatformUsersPanel.vue'
import { LIMITES_TEXTO } from '@/lib/limits'

const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadCompanies), 'name')

const companies = ref<Company[]>([])
const { loading, errorMessage, withLoading } = useAsyncState()

const search = ref('')

type AbaDoCadastro = 'company' | 'address' | 'admin'
const modalTab = ref<AbaDoCadastro>('company')

const abasDoCadastro = computed<Array<FormTab<AbaDoCadastro>>>(() => [
  { id: 'company', label: 'Dados gerais', icon: Building2 },
  { id: 'address', label: 'Endereço', icon: MapPin },
  ...(editingId.value ? [] : [{ id: 'admin' as const, label: 'Administrador da empresa', icon: UserCog }]),
])

const adminForm = ref(emptyAdminForm())

async function loadCompanies() {
  await withLoading(async () => {
    const result = await listCompanies({ page: page.value, pageSize: pageSize.value, search: search.value || undefined, sortBy: sortBy.value, sortOrder: sortOrder.value })
    companies.value = result.data
    applyMeta(result)
  })
}

const { modalOpen, editingId, saving, form, fieldErrors, openModal, handleSubmit } = useCrudModal<
  CompanyDetailsInput,
  Company,
  Awaited<ReturnType<typeof createCompany>>
>({
  emptyForm: () => emptyCompanyForm(),
  toForm: (company) => ({
    name: company.name,
    legalName: company.legalName ?? '',
    document: company.document ?? '',
    stateRegistration: company.stateRegistration ?? '',
    contactName: company.contactName ?? '',
    contactEmail: company.contactEmail ?? '',
    phone: company.phone ?? '',
    postalCode: company.postalCode ?? '',
    street: company.street ?? '',
    addressNumber: company.addressNumber ?? '',
    complement: company.complement ?? '',
    district: company.district ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
  }),
  create: (values) =>
    createCompany({
      ...values,
      adminName: adminForm.value.name,
      adminEmail: adminForm.value.email,
      adminPassword: adminForm.value.password,
    }),
  update: (id, values) => updateCompany(id, values),
  reload: loadCompanies,
  createdMessage: (result) => `Empresa criada. Login do admin: ${result.admin.email}`,
  updatedMessage: 'Empresa atualizada com sucesso',
  saveErrorMessage: 'Não foi possível salvar a empresa',
  validate,
  onOpen: () => {
    adminForm.value = emptyAdminForm()
    modalTab.value = 'company'
    // O CEP que já veio gravado não deve disparar consulta ao abrir a edição.
    marcarCepComoCarregado()
  },
  onSaveError: focusTabWithError,
})

function validate(): boolean {
  fieldErrors.value = {}
  validateCompanyFields(form.value, fieldErrors.value)
  if (!editingId.value) validateAdminFields(adminForm.value, fieldErrors.value)

  focusTabWithError()
  return Object.keys(fieldErrors.value).length === 0
}

function focusTabWithError() {
  const campos = Object.keys(fieldErrors.value)
  if (!campos.length) return

  modalTab.value =
    primeiraAbaComErro(campos, [
      { id: 'company', campos: CAMPOS_DA_ABA_GERAL },
      { id: 'address', campos: CAMPOS_DA_ABA_ENDERECO },
    ]) ?? (editingId.value ? 'company' : 'admin')
}

const { lookingUpCep, marcarCepComoCarregado } = useCepLookup(form, fieldErrors)

const { generatePassword: handleGeneratePassword } = useGeneratedPassword((password) => {
  adminForm.value.password = password
  adminForm.value.passwordConfirm = password
  delete fieldErrors.value.adminPassword
  delete fieldErrors.value.adminPasswordConfirm
})


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
        <SearchInput v-model="search" placeholder="Buscar por nome ou CNPJ..." />
        <BaseButton class="!px-2.5 sm:!px-4" title="Nova empresa" aria-label="Nova empresa" @click="openModal(null)">
          <Plus :size="16" /> <span class="hidden sm:inline">Nova empresa</span>
        </BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <SortableTableHeader field="name" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Nome fantasia</SortableTableHeader>
            <SortableTableHeader field="document" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">CNPJ</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Contato</th>
            <SortableTableHeader field="active" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Situação</SortableTableHeader>
            <th data-actions class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="companies.length === 0">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma empresa cadastrada.
            </td>
          </tr>
          <tr
            v-for="company in companies"
            v-else
            :key="company.id"
            class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
            title="Duplo clique para editar"
            @dblclick="openModal(company)"
          >
            <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="company.name" :max-length="45" />
            </td>
            <td class="max-w-64 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="formatCnpj(company.document)" :max-length="35" />
            </td>
            <td class="max-w-64 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              <ExpandableText :text="company.contactEmail || formatPhone(company.phone)" :max-length="35" />
            </td>
            <td class="px-4 py-3 whitespace-nowrap" @dblclick.stop @click.stop>
              <div class="flex items-center gap-2">
                <StatusBadge :active="company.active" inactive-text="Suspenso" />
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
                @click="openModal(company)"
              >
                <Pencil :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-bind="paginationProps" />
    </div>

    <PlatformUsersPanel />

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar empresa' : 'Nova empresa'" size="lg" @close="modalOpen = false">
      <FormTabs v-model="modalTab" :tabs="abasDoCadastro" aria-label="Etapas do cadastro da empresa" numbered />

      <form class="space-y-5" novalidate @submit.prevent="handleSubmit">
        <CompanyFormFields v-show="modalTab === 'company'" :form="form" :field-errors="fieldErrors" section="geral" />
        <CompanyFormFields
          v-show="modalTab === 'address'"
          :form="form"
          :field-errors="fieldErrors"
          section="endereco"
          :looking-up-cep="lookingUpCep"
        />
        <div v-if="!editingId" v-show="modalTab === 'admin'" class="space-y-5">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Administrador da empresa</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput v-model="adminForm.name" label="Nome" :maxlength="LIMITES_TEXTO.nome" :error="fieldErrors.adminName" required />
            <BaseInput v-model="adminForm.email" type="email" label="E-mail" :maxlength="LIMITES_TEXTO.email" :error="fieldErrors.adminEmail" required />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <BaseInput v-model="adminForm.password" type="password" label="Senha" :maxlength="LIMITES_TEXTO.senha" :error="fieldErrors.adminPassword" required />
              <button type="button" class="mt-1.5 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400" @click="handleGeneratePassword">
                <Wand2 :size="12" /> Gerar senha aleatória
              </button>
            </div>
            <BaseInput
              v-model="adminForm.passwordConfirm"
              type="password"
              label="Confirmar senha"
              :maxlength="LIMITES_TEXTO.senha"
              :error="fieldErrors.adminPasswordConfirm"
              required
            />
          </div>
        </div>
        <div class="flex justify-between gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <div class="flex gap-2">
            <BaseButton v-if="modalTab !== 'company'" variant="secondary" type="button" @click="modalTab = modalTab === 'admin' ? 'address' : 'company'">Voltar</BaseButton>
            <BaseButton v-if="modalTab === 'company'" type="button" @click="modalTab = 'address'">Continuar</BaseButton>
            <BaseButton v-else-if="modalTab === 'address' && !editingId" type="button" @click="modalTab = 'admin'">Continuar</BaseButton>
            <BaseButton v-else type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
          </div>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
