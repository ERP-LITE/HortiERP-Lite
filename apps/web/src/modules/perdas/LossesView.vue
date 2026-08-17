<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Ban, Pencil, Plus } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import ExportCsvButton from '@/components/ui/ExportCsvButton.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import ExpandableText from '@/components/ui/ExpandableText.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import type { PeriodValue } from '@/lib/period'
import { formatDate } from '@/lib/format'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { toastSuccess } from '@/lib/alerts'
import { listAllProducts } from '@/services/productsService'
import { cancelLoss, createLoss, listAllLosses, listLosses, updateLoss } from '@/services/lossesService'
import { csvNumber } from '@/lib/csv'
import { useAuthStore } from '@/stores/auth'
import { usePagination } from '@/composables/usePagination'
import { useFilterModal } from '@/composables/useFilterModal'
import { useTableSort } from '@/composables/useTableSort'
import type { Loss, LossReason, Product } from '@/types'

const auth = useAuthStore()
const canManage = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'gerente')
const canCorrect = (loss: Loss) => canManage.value && !loss.cancelledAt

const reasonOptions: { value: LossReason; label: string }[] = [
  { value: 'vencido', label: 'Vencido' },
  { value: 'avariado', label: 'Avariado' },
  { value: 'roubo_furto', label: 'Roubo/Furto' },
  { value: 'erro_operacional', label: 'Erro operacional' },
  { value: 'outro', label: 'Outro' },
]
const reasonFilterOptions = [{ value: 'todos', label: 'Todos os motivos' }, ...reasonOptions]

const reasonLabels = Object.fromEntries(reasonOptions.map((r) => [r.value, r.label])) as Record<LossReason, string>

const { page, pageSize, total, totalPages, applyMeta, watchSearch } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => { page.value = 1; return loadLosses() }, 'lossDate', 'desc')

const losses = ref<Loss[]>([])
const products = ref<Product[]>([])
const loading = ref(true)
const errorMessage = ref('')

const search = ref('')
function emptyFilters() {
  return {
    productId: 'todos',
    reason: 'todos',
    period: { preset: 'todos', from: '', to: '' } as PeriodValue,
    includeCancelled: false,
  }
}
const { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters } = useFilterModal(
  emptyFilters,
  () => {
    page.value = 1
    loadLosses()
  },
)
const activeFilterCount = computed(
  () =>
    Number(filters.value.productId !== 'todos') +
    Number(filters.value.reason !== 'todos') +
    Number(filters.value.period.preset !== 'todos') +
    Number(filters.value.includeCancelled),
)

const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const editingLoss = ref<Loss | null>(null)
const form = ref({ productId: '', quantity: '', reason: '' as LossReason | '', notes: '' })
const fieldErrors = ref<Record<string, string>>({})

const cancelModalOpen = ref(false)
const cancelling = ref(false)
const cancelTarget = ref<Loss | null>(null)
const cancelForm = ref({ cancelReason: '' })
const cancelErrors = ref<Record<string, string>>({})

const productOptions = computed(() => products.value.map((p) => ({ value: p.id, label: p.name })))
const productFilterOptions = computed(() => [{ value: 'todos', label: 'Todos os produtos' }, ...productOptions.value])

async function loadLosses() {
  loading.value = true
  try {
    const result = await listLosses({
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      productId: filters.value.productId !== 'todos' ? filters.value.productId : undefined,
      reason: filters.value.reason !== 'todos' ? (filters.value.reason as LossReason) : undefined,
      from: filters.value.period.from || undefined,
      to: filters.value.period.to || undefined,
      includeCancelled: filters.value.includeCancelled || undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    losses.value = result.data
    applyMeta(result)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function loadProductOptions() {
  try {
    products.value = await listAllProducts({ active: true })
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

async function loadAll() {
  await Promise.all([loadLosses(), loadProductOptions()])
}

function openCreateModal() {
  editingId.value = null
  editingLoss.value = null
  form.value = { productId: '', quantity: '', reason: '', notes: '' }
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEditModal(loss: Loss) {
  editingId.value = loss.id
  editingLoss.value = loss
  form.value = {
    productId: loss.productId,
    quantity: String(Number(loss.quantity)),
    reason: loss.reason,
    notes: loss.notes ?? '',
  }
  fieldErrors.value = {}
  modalOpen.value = true
}

function validate(): boolean {
  fieldErrors.value = {}
  if (!editingId.value) {
    if (!form.value.productId) fieldErrors.value.productId = 'Selecione o produto'
    if (!form.value.quantity || Number(form.value.quantity) <= 0) {
      fieldErrors.value.quantity = 'Informe uma quantidade maior que zero'
    }
  }
  if (!form.value.reason) fieldErrors.value.reason = 'Selecione o motivo'
  return Object.keys(fieldErrors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  if (!form.value.reason) return

  saving.value = true
  try {
    if (editingId.value) {
      await updateLoss(editingId.value, {
        reason: form.value.reason,
        notes: form.value.notes || null,
      })
      modalOpen.value = false
      await loadAll()
      toastSuccess('Perda corrigida com sucesso')
    } else {
      await createLoss({
        productId: form.value.productId,
        quantity: Number(form.value.quantity),
        reason: form.value.reason,
        notes: form.value.notes || undefined,
      })
      modalOpen.value = false
      await loadAll()
      toastSuccess('Perda registrada com sucesso')
    }
  } catch (error) {
    const fallback = editingId.value ? 'Não foi possível corrigir a perda' : 'Não foi possível registrar a perda'
    const result = resolveFormError(error, fallback)
    fieldErrors.value = result.fieldErrors
    errorMessage.value = result.message
  } finally {
    saving.value = false
  }
}

function openCancelModal(loss: Loss) {
  cancelTarget.value = loss
  cancelForm.value = { cancelReason: '' }
  cancelErrors.value = {}
  cancelModalOpen.value = true
}

async function handleCancel() {
  cancelErrors.value = {}
  if (!cancelForm.value.cancelReason.trim()) {
    cancelErrors.value.cancelReason = 'Informe o motivo do cancelamento'
    return
  }
  if (!cancelTarget.value) return

  cancelling.value = true
  try {
    await cancelLoss(cancelTarget.value.id, cancelForm.value.cancelReason.trim())
    cancelModalOpen.value = false
    await loadAll()
    toastSuccess('Perda cancelada e quantidade devolvida ao estoque')
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível cancelar a perda')
    cancelErrors.value = result.fieldErrors
    errorMessage.value = result.message
  } finally {
    cancelling.value = false
  }
}

watchSearch(search, loadLosses)
async function exportCsv() {
  const all = await listAllLosses({
    search: search.value || undefined,
    productId: filters.value.productId !== 'todos' ? filters.value.productId : undefined,
    reason: filters.value.reason !== 'todos' ? (filters.value.reason as LossReason) : undefined,
    from: filters.value.period.from || undefined,
    to: filters.value.period.to || undefined,
    includeCancelled: filters.value.includeCancelled || undefined,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  })

  return {
    headers: [
      'Data',
      'Produto',
      'Motivo',
      'Quantidade',
      'Custo unitario',
      'Valor perdido',
      'Situacao',
      'Registrado por',
      'Observacao',
    ],
    rows: all.map((item) => [
      formatDate(item.lossDate),
      item.product?.name ?? '',
      reasonLabels[item.reason],
      csvNumber(item.quantity, 3),
      csvNumber(item.unitCost ?? item.product?.costPrice),
      item.cancelledAt ? '' : csvNumber(Number(item.quantity) * Number(item.unitCost ?? item.product?.costPrice ?? 0)),
      item.cancelledAt ? `Cancelada: ${item.cancelReason ?? ''}`.trim() : 'Válida',
      item.createdByUser?.name ?? '',
      item.notes ?? '',
    ]),
  }
}

onMounted(loadAll)
</script>

<template>
  <div>
    <PageHeader title="Perdas" subtitle="Registro de perdas com baixa automática no estoque">
      <template #actions>
        <SearchInput v-model="search" placeholder="Buscar por produto ou observação..." />
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
        <ExportCsvButton file-name="perdas" :load="exportCsv" />
        <BaseButton class="!px-2.5 sm:!px-4" title="Registrar perda" aria-label="Registrar perda" @click="openCreateModal">
          <Plus :size="16" /> <span class="hidden sm:inline">Registrar perda</span>
        </BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <SortableTableHeader field="lossDate" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Data</SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Produto
            </th>
            <SortableTableHeader field="quantity" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Quantidade</SortableTableHeader>
            <SortableTableHeader field="reason" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">Motivo</SortableTableHeader>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell"
            >
              Observações
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Registrado por
            </th>
            <th class="print:hidden px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="losses.length === 0">
            <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma perda registrada.
            </td>
          </tr>
          <tr
            v-for="loss in losses"
            v-else
            :key="loss.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-700/40"
            :class="[loss.cancelledAt ? 'opacity-60' : '', canCorrect(loss) ? 'cursor-pointer' : '']"
            :title="canCorrect(loss) ? 'Duplo clique para corrigir motivo ou observações' : ''"
            @dblclick="canCorrect(loss) && openEditModal(loss)"
          >
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatDate(loss.lossDate) }}
            </td>
            <td class="max-w-72 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <ExpandableText :text="loss.product?.name" :max-length="45" />
            </td>
            <td
              class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap"
              :class="loss.cancelledAt ? 'line-through' : ''"
            >
              {{ Number(loss.quantity) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge v-if="loss.cancelledAt" variant="neutral">Cancelada</BaseBadge>
              <BaseBadge v-else variant="danger">{{ reasonLabels[loss.reason] }}</BaseBadge>
            </td>
            <td class="max-w-80 px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
              <ExpandableText
                :text="loss.cancelledAt ? `Cancelada: ${loss.cancelReason ?? ''}` : loss.notes"
              />
            </td>
            <td class="max-w-64 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
              <ExpandableText :text="loss.createdByUser?.name" :max-length="40" empty-text="Usuário não identificado" />
            </td>
            <td
              v-if="canManage"
              class="print:hidden px-4 py-3 text-right space-x-1 whitespace-nowrap"
              @dblclick.stop
            >
              <template v-if="!loss.cancelledAt">
                <button
                  class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                  title="Corrigir motivo ou observações"
                  @click="openEditModal(loss)"
                >
                  <Pencil :size="16" />
                </button>
                <button
                  class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  title="Cancelar perda e devolver ao estoque"
                  @click="openCancelModal(loss)"
                >
                  <Ban :size="16" />
                </button>
              </template>
            </td>
            <td v-else class="print:hidden px-4 py-3" />
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

    <BaseModal
      :open="modalOpen"
      :title="editingId ? 'Corrigir perda' : 'Registrar perda'"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div v-if="editingId" class="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 space-y-1">
          <p class="text-sm text-gray-900 dark:text-gray-100 font-medium">
            {{ editingLoss?.product?.name }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ Number(editingLoss?.quantity ?? 0) }} · {{ formatDate(editingLoss?.lossDate ?? '') }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Produto, quantidade e data não podem ser alterados. Se algum deles está errado, cancele a perda e registre
            novamente.
          </p>
        </div>
        <template v-else>
          <BaseSelect
            v-model="form.productId"
            label="Produto"
            :options="productOptions"
            :error="fieldErrors.productId"
            searchable
          />
          <BaseInput
            v-model="form.quantity"
            :decimal-places="3"
            label="Quantidade"
            :error="fieldErrors.quantity"
          />
        </template>
        <BaseSelect v-model="form.reason" label="Motivo" :options="reasonOptions" :error="fieldErrors.reason" />
        <BaseInput v-model="form.notes" label="Observações (opcional)" :error="fieldErrors.notes" />

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton :variant="editingId ? 'primary' : 'danger'" type="submit" :disabled="saving">
            {{ saving ? 'Salvando...' : editingId ? 'Salvar correção' : 'Registrar perda' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="cancelModalOpen" title="Cancelar perda" @close="cancelModalOpen = false">
      <form class="space-y-4" @submit.prevent="handleCancel">
        <div class="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 space-y-1">
          <p class="text-sm text-gray-900 dark:text-gray-100 font-medium">
            {{ cancelTarget?.product?.name }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ Number(cancelTarget?.quantity ?? 0) }} · {{ reasonLabels[cancelTarget?.reason ?? 'outro'] }}
          </p>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          A quantidade volta ao estoque como um ajuste rastreável e a perda deixa de contar nos relatórios e no painel.
          O registro não é apagado.
        </p>
        <BaseInput
          v-model="cancelForm.cancelReason"
          label="Motivo do cancelamento"
          :error="cancelErrors.cancelReason"
        />

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="cancelModalOpen = false">Voltar</BaseButton>
          <BaseButton variant="danger" type="submit" :disabled="cancelling">
            {{ cancelling ? 'Cancelando...' : 'Cancelar perda' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="filterModalOpen" title="Filtrar perdas" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <BaseSelect v-model="draftFilters.productId" label="Produto" :options="productFilterOptions" searchable />
        <BaseSelect v-model="draftFilters.reason" label="Motivo" :options="reasonFilterOptions" />
        <PeriodPicker v-model="draftFilters.period" />
        <BaseToggle v-model="draftFilters.includeCancelled" label="Mostrar perdas canceladas" />

        <div class="flex justify-between items-center pt-2">
          <button type="button" class="text-sm text-gray-500 hover:underline dark:text-gray-400" @click="clearFilters">
            Limpar
          </button>
          <div class="flex gap-2">
            <BaseButton variant="secondary" type="button" @click="filterModalOpen = false">Cancelar</BaseButton>
            <BaseButton type="submit">Aplicar</BaseButton>
          </div>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
