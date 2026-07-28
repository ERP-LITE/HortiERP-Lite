<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import type { PeriodValue } from '@/lib/period'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { toastSuccess } from '@/lib/alerts'
import { listProducts } from '@/services/productsService'
import { createLoss, listLosses } from '@/services/lossesService'
import { usePagination } from '@/composables/usePagination'
import type { Loss, LossReason, Product } from '@/types'

const reasonOptions: { value: LossReason; label: string }[] = [
  { value: 'vencido', label: 'Vencido' },
  { value: 'avariado', label: 'Avariado' },
  { value: 'roubo_furto', label: 'Roubo/Furto' },
  { value: 'erro_operacional', label: 'Erro operacional' },
  { value: 'outro', label: 'Outro' },
]
const reasonFilterOptions = [{ value: 'todos', label: 'Todos os motivos' }, ...reasonOptions]

const reasonLabels = Object.fromEntries(reasonOptions.map((r) => [r.value, r.label])) as Record<LossReason, string>

const { page, pageSize, total, totalPages, applyMeta } = usePagination()

const losses = ref<Loss[]>([])
const products = ref<Product[]>([])
const loading = ref(true)
const errorMessage = ref('')

function emptyFilters() {
  return { productId: 'todos', reason: 'todos', period: { preset: 'todos', from: '', to: '' } as PeriodValue }
}
const filters = ref(emptyFilters())
const draftFilters = ref(emptyFilters())
const filterModalOpen = ref(false)
const activeFilterCount = computed(
  () =>
    Number(filters.value.productId !== 'todos') +
    Number(filters.value.reason !== 'todos') +
    Number(filters.value.period.preset !== 'todos'),
)

const modalOpen = ref(false)
const saving = ref(false)
const form = ref({ productId: '', quantity: '', reason: '' as LossReason | '', notes: '' })
const fieldErrors = ref<Record<string, string>>({})

const productOptions = computed(() => products.value.map((p) => ({ value: p.id, label: p.name })))
const productFilterOptions = computed(() => [{ value: 'todos', label: 'Todos os produtos' }, ...productOptions.value])

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

async function loadLosses() {
  loading.value = true
  try {
    const result = await listLosses({
      page: page.value,
      pageSize: pageSize.value,
      productId: filters.value.productId !== 'todos' ? filters.value.productId : undefined,
      reason: filters.value.reason !== 'todos' ? (filters.value.reason as LossReason) : undefined,
      from: filters.value.period.from || undefined,
      to: filters.value.period.to || undefined,
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
    const result = await listProducts({ page: 1, pageSize: 100 })
    products.value = result.data
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

async function loadAll() {
  await Promise.all([loadLosses(), loadProductOptions()])
}

function openFilterModal() {
  draftFilters.value = { ...filters.value }
  filterModalOpen.value = true
}

function applyFilters() {
  filters.value = { ...draftFilters.value }
  filterModalOpen.value = false
  page.value = 1
  loadLosses()
}

function clearFilters() {
  filters.value = emptyFilters()
  draftFilters.value = emptyFilters()
  filterModalOpen.value = false
  page.value = 1
  loadLosses()
}

function openCreateModal() {
  form.value = { productId: '', quantity: '', reason: '', notes: '' }
  fieldErrors.value = {}
  modalOpen.value = true
}

function validate(): boolean {
  fieldErrors.value = {}
  if (!form.value.productId) fieldErrors.value.productId = 'Selecione o produto'
  if (!form.value.quantity || Number(form.value.quantity) <= 0) {
    fieldErrors.value.quantity = 'Informe uma quantidade maior que zero'
  }
  if (!form.value.reason) fieldErrors.value.reason = 'Selecione o motivo'
  return Object.keys(fieldErrors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  if (!form.value.reason) return

  saving.value = true
  try {
    await createLoss({
      productId: form.value.productId,
      quantity: Number(form.value.quantity),
      reason: form.value.reason,
      notes: form.value.notes || undefined,
    })
    modalOpen.value = false
    await loadAll()
    toastSuccess('Perda registrada com sucesso')
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível registrar a perda')
    fieldErrors.value = result.fieldErrors
    errorMessage.value = result.message
  } finally {
    saving.value = false
  }
}

watch([page, pageSize], loadLosses)
onMounted(loadAll)
</script>

<template>
  <div>
    <PageHeader title="Perdas" subtitle="Registro de perdas com baixa automática no estoque">
      <template #actions>
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <BaseButton @click="openCreateModal"><Plus :size="16" /> Registrar perda</BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Produto
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Quantidade
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Motivo
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell"
            >
              Observações
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="losses.length === 0">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma perda registrada.
            </td>
          </tr>
          <tr v-for="loss in losses" v-else :key="loss.id">
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatDate(loss.lossDate) }}
            </td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
              {{ loss.product?.name }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {{ Number(loss.quantity) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge variant="danger">{{ reasonLabels[loss.reason] }}</BaseBadge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
              {{ loss.notes || '—' }}
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

    <BaseModal :open="modalOpen" title="Registrar perda" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <BaseSelect v-model="form.productId" label="Produto" :options="productOptions" :error="fieldErrors.productId" />
        <BaseInput
          v-model="form.quantity"
          type="number"
          step="0.001"
          label="Quantidade"
          :error="fieldErrors.quantity"
        />
        <BaseSelect v-model="form.reason" label="Motivo" :options="reasonOptions" :error="fieldErrors.reason" />
        <BaseInput v-model="form.notes" label="Observações (opcional)" />

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton variant="danger" type="submit" :disabled="saving">
            {{ saving ? 'Salvando...' : 'Registrar perda' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="filterModalOpen" title="Filtrar perdas" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <BaseSelect v-model="draftFilters.productId" label="Produto" :options="productFilterOptions" />
        <BaseSelect v-model="draftFilters.reason" label="Motivo" :options="reasonFilterOptions" />
        <PeriodPicker v-model="draftFilters.period" />

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
