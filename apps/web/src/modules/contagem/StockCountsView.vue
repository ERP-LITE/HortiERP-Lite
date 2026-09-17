<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ClipboardList, Eye, Play } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import Pagination from '@/components/ui/Pagination.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import StockCountProgress from '@/components/contagem/StockCountProgress.vue'
import StockCountStatusBadge from '@/components/contagem/StockCountStatusBadge.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { usePagination } from '@/composables/usePagination'
import { useTableSort } from '@/composables/useTableSort'
import { usePermissions } from '@/composables/usePermissions'
import { listAllCategories } from '@/services/categoriesService'
import { getOpenStockCount, listStockCounts, startStockCount } from '@/services/stockCountsService'
import { getApiErrorMessage } from '@/services/api'
import { LIMITES_TEXTO } from '@/lib/limits'
import { formatDateTime } from '@/lib/format'
import { escopoDaContagem, textoDoProgresso } from '@/lib/stockCount'
import type { Category, StockCount, StockCountSummary } from '@/types'

const router = useRouter()
const { canManage } = usePermissions()
const { loading, errorMessage, withLoading, captureError } = useAsyncState()
const { page, pageSize, applyMeta, paginationProps, reload } = usePagination()
const { sortBy, sortOrder, toggleSort } = useTableSort(() => reload(loadCounts), 'startedAt', 'desc')

const counts = ref<StockCountSummary[]>([])
const openCount = ref<StockCount | null>(null)
const categories = ref<Category[]>([])

const startModalOpen = ref(false)
const startForm = ref({ categoryId: '', notes: '' })
const starting = ref(false)
const startErrorMessage = ref('')

async function loadCounts() {
  await withLoading(async () => {
    const result = await listStockCounts({
      page: page.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    counts.value = result.data
    applyMeta(result)
  }, 'Não foi possível carregar as contagens')
}

async function loadOpenCount() {
  await captureError(async () => {
    openCount.value = await getOpenStockCount()
  }, 'Não foi possível verificar se há contagem em aberto')
}

async function openStartModal() {
  if (categories.value.length === 0) {
    await captureError(async () => {
      categories.value = await listAllCategories({ active: true })
    }, 'Não foi possível carregar as categorias')
  }
  startForm.value = { categoryId: '', notes: '' }
  startErrorMessage.value = ''
  startModalOpen.value = true
}

async function handleStart() {
  starting.value = true
  startErrorMessage.value = ''
  try {
    const contagem = await startStockCount({
      categoryId: startForm.value.categoryId || undefined,
      notes: startForm.value.notes.trim() || undefined,
    })
    startModalOpen.value = false
    router.push({ name: 'contagem-sessao', params: { id: contagem.id } })
  } catch (error) {
    startErrorMessage.value = getApiErrorMessage(error, 'Não foi possível iniciar a contagem')
  } finally {
    starting.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadCounts(), loadOpenCount()])
})

watch([page, pageSize], loadCounts)
</script>

<template>
  <div>
    <PageHeader
      title="Contagem de estoque"
      subtitle="Confira a mercadoria na loja e descubra o que sumiu sem ninguém registrar"
    >
      <template #actions>
        <BaseButton v-if="canManage" :disabled="Boolean(openCount)" @click="openStartModal">
          <Play :size="16" /> Iniciar contagem
        </BaseButton>
      </template>
    </PageHeader>

    <div
      v-if="openCount"
      class="mb-6 rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-900/50 dark:bg-primary-900/20"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-primary-800 dark:text-primary-300">
            Contagem em aberto: {{ escopoDaContagem(openCount.categoryName) }}
          </p>
          <p class="mt-0.5 text-xs text-primary-700 dark:text-primary-400">
            Iniciada em {{ formatDateTime(openCount.startedAt) }} ·
            {{ textoDoProgresso(openCount.resumo.countedCount, openCount.resumo.itemsCount) }}
          </p>
        </div>
        <RouterLink :to="{ name: 'contagem-sessao', params: { id: openCount.id } }" class="shrink-0">
          <BaseButton>Continuar contagem</BaseButton>
        </RouterLink>
      </div>
      <StockCountProgress
        class="mt-3"
        compact
        :counted="openCount.resumo.countedCount"
        :total="openCount.resumo.itemsCount"
      />
    </div>

    <p v-if="errorMessage" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table v-mobile-accordion class="mobile-accordion-table min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <SortableTableHeader field="startedAt" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">
              Iniciada em
            </SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              O que foi contado
            </th>
            <SortableTableHeader field="status" :active-field="sortBy" :order="sortOrder" @sort="toggleSort">
              Situação
            </SortableTableHeader>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Progresso
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Iniciada por
            </th>
            <th data-actions class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td>
          </tr>
          <tr v-else-if="counts.length === 0">
            <td colspan="6" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              <ClipboardList :size="28" class="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
              Nenhuma contagem ainda. A primeira costuma ser a que mais revela.
            </td>
          </tr>
          <tr v-for="contagem in counts" v-else :key="contagem.id">
            <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDateTime(contagem.startedAt) }}
            </td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ escopoDaContagem(contagem.categoryName) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <StockCountStatusBadge :status="contagem.status" />
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ textoDoProgresso(contagem.countedCount, contagem.itemsCount) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ contagem.createdByUser?.name ?? 'Usuário não identificado' }}
            </td>
            <td class="print:hidden px-4 py-3 text-right">
              <RouterLink
                :to="{ name: 'contagem-sessao', params: { id: contagem.id } }"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                title="Abrir a contagem"
                aria-label="Abrir a contagem"
              >
                <Eye :size="16" />
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination v-bind="paginationProps" />
    </div>

    <BaseModal :open="startModalOpen" title="Iniciar contagem de estoque" @close="startModalOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="handleStart">
        <div
          class="rounded-lg border border-primary-200 bg-primary-50 p-3 text-xs text-primary-800 dark:border-primary-900/50 dark:bg-primary-900/20 dark:text-primary-300"
        >
          <p>
            Durante a contagem o sistema não mostra quanto ele acha que tem, para quem conta não copiar o número da
            tela. O saldo e a diferença só aparecem quando você mandar conferir.
          </p>
        </div>

        <BaseSelect
          v-model="startForm.categoryId"
          label="O que vai ser contado"
          placeholder="Loja toda"
          :options="[
            { value: '', label: 'Loja toda' },
            ...categories.map((categoria) => ({ value: categoria.id, label: categoria.name })),
          ]"
        />
        <BaseInput
          v-model="startForm.notes"
          label="Observação (opcional)"
          placeholder="Ex.: balanço do primeiro semestre"
          :maxlength="LIMITES_TEXTO.observacoes"
        />

        <p v-if="startErrorMessage" class="text-sm text-red-600 dark:text-red-400">{{ startErrorMessage }}</p>

        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="startModalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :disabled="starting">{{ starting ? 'Iniciando...' : 'Iniciar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
