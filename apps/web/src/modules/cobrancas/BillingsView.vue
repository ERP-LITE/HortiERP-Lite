<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import DateInput from '@/components/ui/DateInput.vue'
import MonthInput from '@/components/ui/MonthInput.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import { useTableSort } from '@/composables/useTableSort'
import { listAllCompanies } from '@/services/companiesService'
import {
  createBilling,
  deleteBilling,
  listBillings,
  updateBilling,
  type Billing,
  type BillingInput,
  type BillingStatus,
} from '@/services/billingsService'
import { confirmDelete, toastError, toastSuccess } from '@/lib/alerts'
import { resolveFormError } from '@/services/api'
import { formatCurrency, formatDateOnly, formatMonthYear } from '@/lib/format'
import { todayIso, type PeriodValue } from '@/lib/period'

const { page, pageSize, total, totalPages, applyMeta, watchSearch } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => { page.value = 1; return loadBillings() }, 'dueDate', 'desc')
const billings = ref<Billing[]>([])
const companies = ref<{ value: string; label: string }[]>([])
const loading = ref(true)
const saving = ref(false)
const search = ref('')
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const markedPaid = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const errorMessage = ref('')

function emptyFilters() {
  return { status: 'todos', period: { preset: 'todos', from: '', to: '' } as PeriodValue }
}
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  emptyFilters,
  () => {
    page.value = 1
    loadBillings()
  },
)
const activeFilterCount = computed(
  () => Number(filters.value.status !== 'todos') + Number(filters.value.period.preset !== 'todos'),
)

// O BaseInput com `decimal-places` devolve string, então o formulário guarda tudo como
// texto e converte só no envio — mesmo padrão das telas de perdas e entradas.
interface BillingForm {
  companyId: string
  referenceMonth: string
  dueDate: string
  amount: string
  paidAmount: string
  paidAt: string
  notes: string
}

const emptyForm = (): BillingForm => ({
  companyId: '',
  referenceMonth: todayIso().slice(0, 7),
  dueDate: '',
  amount: '',
  paidAmount: '',
  paidAt: '',
  notes: '',
})
const form = ref<BillingForm>(emptyForm())

const statusOptions = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'paid', label: 'Pagos' },
  { value: 'overdue', label: 'Atrasados' },
]

function statusLabel(value: BillingStatus) {
  return { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado' }[value]
}

function statusVariant(value: BillingStatus) {
  return ({ paid: 'success', pending: 'warning', overdue: 'danger' } as const)[value]
}

async function loadBillings() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await listBillings({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      from: filters.value.period.from || undefined,
      to: filters.value.period.to || undefined,
      status: filters.value.status !== 'todos' ? filters.value.status as BillingStatus : undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    billings.value = result.data
    applyMeta(result)
  } catch (error) {
    errorMessage.value = resolveFormError(error, 'Não foi possível carregar as cobranças').message
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.value = emptyForm()
  markedPaid.value = false
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(billing: Billing) {
  editingId.value = billing.id
  markedPaid.value = Boolean(billing.paidAt)
  form.value = {
    companyId: billing.companyId,
    referenceMonth: billing.referenceMonth.slice(0, 7),
    dueDate: billing.dueDate,
    amount: billing.amount,
    paidAmount: billing.paidAmount ?? '',
    paidAt: billing.paidAt ?? '',
    notes: billing.notes ?? '',
  }
  fieldErrors.value = {}
  modalOpen.value = true
}

function validate() {
  fieldErrors.value = {}
  if (!form.value.companyId) fieldErrors.value.companyId = 'Selecione a empresa'
  if (!form.value.referenceMonth) fieldErrors.value.referenceMonth = 'Informe a competência'
  if (!form.value.dueDate) fieldErrors.value.dueDate = 'Informe o vencimento'
  if (!(Number(form.value.amount) > 0)) fieldErrors.value.amount = 'Informe um valor válido'
  if (markedPaid.value && !(Number(form.value.paidAmount) > 0)) fieldErrors.value.paidAmount = 'Informe o valor pago'
  if (markedPaid.value && !form.value.paidAt) fieldErrors.value.paidAt = 'Informe a data do pagamento'
  return Object.keys(fieldErrors.value).length === 0
}

async function save() {
  if (!validate()) return
  saving.value = true
  const payload: BillingInput = {
    companyId: form.value.companyId,
    referenceMonth: form.value.referenceMonth,
    dueDate: form.value.dueDate,
    amount: Number(form.value.amount),
    paidAmount: markedPaid.value ? Number(form.value.paidAmount) : null,
    paidAt: markedPaid.value ? form.value.paidAt : null,
    notes: form.value.notes || null,
  }
  try {
    if (editingId.value) await updateBilling(editingId.value, payload)
    else await createBilling(payload)
    toastSuccess(editingId.value ? 'Cobrança atualizada' : 'Cobrança cadastrada')
    modalOpen.value = false
    await loadBillings()
  } catch (error) {
    const resolved = resolveFormError(error, 'Não foi possível salvar a cobrança')
    fieldErrors.value = resolved.fieldErrors
    if (resolved.message) toastError(resolved.message)
  } finally {
    saving.value = false
  }
}

async function removeBilling(billing: Billing) {
  const confirmed = await confirmDelete({
    title: 'Excluir cobrança?',
    text: `${billing.companyName} — ${formatMonthYear(billing.referenceMonth)}`,
  })
  if (!confirmed) return
  try {
    await deleteBilling(billing.id)
    toastSuccess('Cobrança excluída')
    await loadBillings()
  } catch (error) {
    toastError(resolveFormError(error, 'Não foi possível excluir a cobrança').message)
  }
}

watch(markedPaid, (paid) => {
  if (paid) {
    form.value.paidAmount ||= form.value.amount
    form.value.paidAt ||= todayIso()
  } else {
    form.value.paidAmount = ''
    form.value.paidAt = ''
  }
})
watchSearch(search, loadBillings)
watch([page, pageSize], loadBillings)

onMounted(async () => {
  try {
    companies.value = (await listAllCompanies({ sortBy: 'name', sortOrder: 'asc' }))
      .map((company) => ({ value: company.id, label: company.name }))
  } catch {
    toastError('Não foi possível carregar as empresas')
  }
  await loadBillings()
})
</script>

<template>
  <div>
    <PageHeader title="Cobranças" subtitle="Controle manual das mensalidades dos clientes">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar empresa..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <BaseButton class="!px-2.5 sm:!px-4" @click="openCreate"><Plus :size="16" /> Nova cobrança</BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>
    <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <SortableTableHeader field="companyName" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Empresa</SortableTableHeader>
            <SortableTableHeader field="referenceMonth" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Competência</SortableTableHeader>
            <SortableTableHeader field="dueDate" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Vencimento</SortableTableHeader>
            <SortableTableHeader field="amount" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Valor</SortableTableHeader>
            <SortableTableHeader field="paidAt" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Pagamento</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
            <th class="print:hidden px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="billings.length === 0">
            <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma cobrança encontrada.
            </td>
          </tr>
          <tr
            v-for="billing in billings"
            v-else
            :key="billing.id"
            class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
            title="Duplo clique para editar"
            @dblclick="openEdit(billing)"
          >
            <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="billing.companyName" :max-length="40" />
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">
              {{ formatMonthYear(billing.referenceMonth) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatDateOnly(billing.dueDate) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatCurrency(billing.amount) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              <template v-if="billing.paidAt">
                {{ formatCurrency(billing.paidAmount) }} em {{ formatDateOnly(billing.paidAt) }}
              </template>
              <span v-else>—</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge :variant="statusVariant(billing.status)">{{ statusLabel(billing.status) }}</BaseBadge>
            </td>
            <td class="print:hidden px-4 py-3 text-right space-x-1 whitespace-nowrap" @dblclick.stop>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Editar"
                @click="openEdit(billing)"
              >
                <Pencil :size="16" />
              </button>
              <button
                class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                title="Excluir"
                @click="removeBilling(billing)"
              >
                <Trash2 :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" :total-pages="totalPages" />
    </div>

    <BaseModal :open="modalOpen" :title="editingId ? 'Editar cobrança' : 'Nova cobrança'" @close="modalOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseSelect v-model="form.companyId" label="Empresa" :options="companies" :error="fieldErrors.companyId" />
        <div class="grid gap-4 sm:grid-cols-2">
          <MonthInput v-model="form.referenceMonth" label="Competência" :error="fieldErrors.referenceMonth" />
          <DateInput v-model="form.dueDate" label="Vencimento" :error="fieldErrors.dueDate" />
          <BaseInput v-model="form.amount" :decimal-places="2" label="Valor da mensalidade (R$)" :error="fieldErrors.amount" />
        </div>
        <div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
          <BaseToggle v-model="markedPaid" />
          <span class="text-sm text-gray-700 dark:text-gray-300">Pagamento recebido</span>
        </div>
        <div v-if="markedPaid" class="grid gap-4 sm:grid-cols-2">
          <BaseInput v-model="form.paidAmount" :decimal-places="2" label="Valor pago (R$)" :error="fieldErrors.paidAmount" />
          <DateInput v-model="form.paidAt" label="Data do pagamento" :error="fieldErrors.paidAt" />
        </div>
        <BaseInput v-model="form.notes" label="Observações (opcional)" />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton type="button" variant="secondary" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="filterModalOpen" title="Filtrar cobranças" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <BaseSelect v-model="draftFilters.status" label="Status" :options="statusOptions" :searchable="false" />
        <PeriodPicker v-model="draftFilters.period" />

        <div class="flex items-center justify-between pt-2">
          <button type="button" class="text-sm text-gray-500 hover:underline dark:text-gray-400" @click="clearFilters">
            Limpar
          </button>
          <div class="flex gap-2">
            <BaseButton type="button" variant="secondary" @click="filterModalOpen = false">Cancelar</BaseButton>
            <BaseButton type="submit">Aplicar</BaseButton>
          </div>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
