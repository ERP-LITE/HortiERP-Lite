<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
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
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { toastError, toastSuccess } from '@/lib/alerts'
import { formatCnpj, formatPhone, normalizeCnpj } from '@/lib/format'
import { generateRandomPassword } from '@/lib/password'
import { isValidUf, ufOptions } from '@/lib/ufs'
import { findAddressByCep } from '@/services/cepService'
import {
  createCompany,
  listCompanies,
  setCompanyActive,
  updateCompany,
  type CompanyDetailsInput,
} from '@/services/companiesService'
import { usePagination } from '@/composables/usePagination'
import { useTableSort } from '@/composables/useTableSort'
import type { Company } from '@/types'
import PlatformUsersPanel from './PlatformUsersPanel.vue'

const { page, pageSize, total, totalPages, applyMeta, reload, watchSearch, paginationProps } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadCompanies), 'name')

const companies = ref<Company[]>([])
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const modalTab = ref<'company' | 'address' | 'admin'>('company')
const lookingUpCep = ref(false)
let lastLookedUpCep = ''
let cepLookupSequence = 0
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

const emptyCompanyDetails: CompanyDetailsInput = {
  name: '',
  legalName: '',
  document: '',
  stateRegistration: '',
  contactName: '',
  contactEmail: '',
  phone: '',
  postalCode: '',
  street: '',
  addressNumber: '',
  complement: '',
  district: '',
  city: '',
  state: '',
}
const emptyAdmin = { name: '', email: '', password: '', passwordConfirm: '' }

const form = ref<CompanyDetailsInput>({ ...emptyCompanyDetails })
const adminForm = ref({ ...emptyAdmin })

const generalFields = ['name', 'legalName', 'document', 'stateRegistration', 'contactName', 'contactEmail', 'phone']
const addressFields = ['postalCode', 'street', 'addressNumber', 'complement', 'district', 'city', 'state']

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

async function loadCompanies() {
  loading.value = true
  try {
    const result = await listCompanies({ page: page.value, pageSize: pageSize.value, search: search.value || undefined, sortBy: sortBy.value, sortOrder: sortOrder.value })
    companies.value = result.data
    applyMeta(result)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openModal(company: Company | null) {
  editingId.value = company?.id ?? null
  form.value = company
    ? {
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
      }
    : { ...emptyCompanyDetails }
  adminForm.value = { ...emptyAdmin }
  fieldErrors.value = {}
  modalTab.value = 'company'
  lastLookedUpCep = onlyDigits(form.value.postalCode)
  modalOpen.value = true
}

function validate(): boolean {
  const values = form.value
  fieldErrors.value = {}
  if (!values.name.trim()) fieldErrors.value.name = 'Informe o nome fantasia'
  if (!values.legalName.trim()) fieldErrors.value.legalName = 'Informe a razão social'
  if (normalizeCnpj(values.document).length !== 14) fieldErrors.value.document = 'Informe um CNPJ válido'
  if (!values.contactName.trim()) fieldErrors.value.contactName = 'Informe o responsável'
  if (!values.contactEmail.trim()) fieldErrors.value.contactEmail = 'Informe o e-mail de contato'
  if (onlyDigits(values.phone).length < 10) fieldErrors.value.phone = 'Informe um telefone válido'
  if (onlyDigits(values.postalCode).length !== 8) fieldErrors.value.postalCode = 'Informe um CEP válido'
  if (!values.street.trim()) fieldErrors.value.street = 'Informe o logradouro'
  if (!values.addressNumber.trim()) fieldErrors.value.addressNumber = 'Informe o número'
  if (!values.district.trim()) fieldErrors.value.district = 'Informe o bairro'
  if (!values.city.trim()) fieldErrors.value.city = 'Informe a cidade'
  if (!isValidUf(values.state)) fieldErrors.value.state = 'Selecione a UF'

  if (!editingId.value) {
    const admin = adminForm.value
    if (!admin.name.trim()) fieldErrors.value.adminName = 'Informe o nome do administrador'
    if (!admin.email.trim()) fieldErrors.value.adminEmail = 'Informe o e-mail do administrador'
    if (!admin.password.trim() || admin.password.length < 8) {
      fieldErrors.value.adminPassword = 'A senha deve ter ao menos 8 caracteres'
    } else if (admin.password !== admin.passwordConfirm) {
      fieldErrors.value.adminPasswordConfirm = 'A confirmação não confere com a senha'
    }
  }

  focusTabWithError()
  return Object.keys(fieldErrors.value).length === 0
}

function focusTabWithError() {
  const fields = Object.keys(fieldErrors.value)
  if (!fields.length) return
  if (fields.some((field) => generalFields.includes(field))) modalTab.value = 'company'
  else if (fields.some((field) => addressFields.includes(field))) modalTab.value = 'address'
  else modalTab.value = editingId.value ? 'company' : 'admin'
}

async function handleGeneratePassword() {
  const password = generateRandomPassword()
  adminForm.value.password = password
  adminForm.value.passwordConfirm = password
  delete fieldErrors.value.adminPassword
  delete fieldErrors.value.adminPasswordConfirm

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
      await updateCompany(editingId.value, form.value)
      toastSuccess('Empresa atualizada com sucesso')
    } else {
      const result = await createCompany({
        ...form.value,
        adminName: adminForm.value.name,
        adminEmail: adminForm.value.email,
        adminPassword: adminForm.value.password,
      })
      toastSuccess(`Empresa criada. Login do admin: ${result.admin.email}`)
    }
    modalOpen.value = false
    await loadCompanies()
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível salvar a empresa')
    fieldErrors.value = result.fieldErrors
    focusTabWithError()
    if (result.message) toastError(result.message)
  } finally {
    saving.value = false
  }
}

async function lookupCep() {
  const cep = onlyDigits(form.value.postalCode)
  if (cep.length !== 8 || cep === lastLookedUpCep) return
  const sequence = ++cepLookupSequence
  lookingUpCep.value = true
  try {
    const address = await findAddressByCep(cep)
    if (sequence !== cepLookupSequence || onlyDigits(form.value.postalCode) !== cep) return
    form.value.street = address.street
    form.value.district = address.district
    form.value.city = address.city
    form.value.state = isValidUf(address.state) ? address.state.toUpperCase() : ''
    if (address.complement && !form.value.complement) form.value.complement = address.complement
    lastLookedUpCep = cep
    toastSuccess('Endereço preenchido pelo CEP')
  } catch (error) {
    if (sequence !== cepLookupSequence || onlyDigits(form.value.postalCode) !== cep) return
    fieldErrors.value.postalCode = error instanceof Error ? error.message : 'Não foi possível consultar o CEP'
  } finally {
    if (sequence === cepLookupSequence) lookingUpCep.value = false
  }
}

watch(() => form.value.postalCode, () => {
  delete fieldErrors.value.postalCode
  void lookupCep()
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
      <div class="mb-5 flex rounded-lg bg-gray-100 p-1 dark:bg-gray-900" role="tablist" aria-label="Etapas do cadastro da empresa">
        <button
          type="button"
          role="tab"
          aria-label="Dados gerais"
          title="Dados gerais"
          :aria-selected="modalTab === 'company'"
          class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="modalTab === 'company' ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-700 dark:text-primary-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="modalTab = 'company'"
        >
          <Building2 :size="17" aria-hidden="true" />
          <span class="hidden sm:inline">1. Dados gerais</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-label="Endereço"
          title="Endereço"
          :aria-selected="modalTab === 'address'"
          class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="modalTab === 'address' ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-700 dark:text-primary-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="modalTab = 'address'"
        >
          <MapPin :size="17" aria-hidden="true" />
          <span class="hidden sm:inline">2. Endereço</span>
        </button>
        <button
          v-if="!editingId"
          type="button"
          role="tab"
          aria-label="Administrador da empresa"
          title="Administrador da empresa"
          :aria-selected="modalTab === 'admin'"
          class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="modalTab === 'admin' ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-700 dark:text-primary-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="modalTab = 'admin'"
        >
          <UserCog :size="17" aria-hidden="true" />
          <span class="hidden sm:inline">3. Administrador da empresa</span>
        </button>
      </div>

      <form class="space-y-5" novalidate @submit.prevent="handleSubmit">
        <div v-show="modalTab === 'company'" class="space-y-5">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Identificação</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput v-model="form.name" label="Nome fantasia" :error="fieldErrors.name" required />
            <BaseInput v-model="form.legalName" label="Razão social" :error="fieldErrors.legalName" required />
            <BaseInput v-model="form.document" mask="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" :error="fieldErrors.document" required />
            <BaseInput v-model="form.stateRegistration" label="Inscrição estadual (opcional)" :error="fieldErrors.stateRegistration" />
          </div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contato</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput v-model="form.contactName" label="Responsável" :error="fieldErrors.contactName" required />
            <BaseInput v-model="form.contactEmail" type="email" label="E-mail de contato" :error="fieldErrors.contactEmail" required />
            <BaseInput v-model="form.phone" mask="phone" label="Telefone / WhatsApp" placeholder="(00) 00000-0000" :error="fieldErrors.phone" required />
          </div>
        </div>
        <div v-show="modalTab === 'address'" class="space-y-5">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Endereço</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <BaseInput v-model="form.postalCode" mask="cep" label="CEP" placeholder="00000-000" :error="fieldErrors.postalCode" required />
              <span v-if="lookingUpCep" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">Buscando endereço...</span>
            </div>
            <BaseInput v-model="form.street" label="Logradouro" :error="fieldErrors.street" required />
            <BaseInput v-model="form.addressNumber" label="Número" :error="fieldErrors.addressNumber" required />
            <BaseInput v-model="form.complement" label="Complemento (opcional)" :error="fieldErrors.complement" />
            <BaseInput v-model="form.district" label="Bairro" :error="fieldErrors.district" required />
            <BaseInput v-model="form.city" label="Cidade" :error="fieldErrors.city" required />
            <BaseSelect v-model="form.state" label="UF" :options="ufOptions" placeholder="Selecione a UF" :error="fieldErrors.state" required />
          </div>
        </div>
        <div v-if="!editingId" v-show="modalTab === 'admin'" class="space-y-5">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Administrador da empresa</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput v-model="adminForm.name" label="Nome" :error="fieldErrors.adminName" required />
            <BaseInput v-model="adminForm.email" type="email" label="E-mail" :error="fieldErrors.adminEmail" required />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <BaseInput v-model="adminForm.password" type="password" label="Senha" :error="fieldErrors.adminPassword" required />
              <button type="button" class="mt-1.5 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400" @click="handleGeneratePassword">
                <Wand2 :size="12" /> Gerar senha aleatória
              </button>
            </div>
            <BaseInput
              v-model="adminForm.passwordConfirm"
              type="password"
              label="Confirmar senha"
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
