<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Eye, EyeOff } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FilterChips from '@/components/ui/FilterChips.vue'
import Pagination from '@/components/ui/Pagination.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import StockCountItemCard from '@/components/contagem/StockCountItemCard.vue'
import StockCountProgress from '@/components/contagem/StockCountProgress.vue'
import StockCountReportTable from '@/components/contagem/StockCountReportTable.vue'
import StockCountStatusBadge from '@/components/contagem/StockCountStatusBadge.vue'
import StockCountTotalsCards from '@/components/contagem/StockCountTotalsCards.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { usePagination } from '@/composables/usePagination'
import { usePermissions } from '@/composables/usePermissions'
import { useFieldErrors } from '@/composables/useFieldErrors'
import {
  cancelStockCount,
  countStockCountItem,
  finishStockCount,
  getStockCount,
  listStockCountItems,
  reopenStockCount,
  reviewStockCount,
  type SituacaoDoItem,
} from '@/services/stockCountsService'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { confirmAction, toastError, toastSuccess } from '@/lib/alerts'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { LIMITES_TEXTO } from '@/lib/limits'
import {
  escopoDaContagem,
  type EstadoDoLancamento,
  podeConferir,
  textoDoProgresso,
} from '@/lib/stockCount'
import type { StockCount, StockCountItem } from '@/types'

const route = useRoute()
const router = useRouter()
const { canManage } = usePermissions()
const { loading, errorMessage, withLoading, captureError } = useAsyncState()
const { page, pageSize, applyMeta, paginationProps, reload, watchSearch } = usePagination()

const id = route.params.id as string
const contagem = ref<StockCount | null>(null)
const itens = ref<StockCountItem[]>([])
const estados = ref<Record<string, EstadoDoLancamento>>({})
const search = ref('')
const situacao = ref<SituacaoDoItem>('todos')
const mudandoEtapa = ref(false)

const cancelModalOpen = ref(false)
const cancelReason = ref('')
const { fieldErrors: cancelErrors, clearFieldErrors: clearCancelErrors } = useFieldErrors(() => ({
  cancelReason: cancelReason.value,
}))
const cancelling = ref(false)

const contando = computed(() => contagem.value?.status === 'em_andamento')

const filtros = computed(() => {
  const base = [
    { value: 'todos', label: 'Todos' },
    { value: 'pendentes', label: 'Falta contar' },
    { value: 'contados', label: 'Já contados' },
  ]
  if (contagem.value?.revelada) base.push({ value: 'divergentes', label: 'Só divergências' })
  return base
})

async function loadCount() {
  await captureError(async () => {
    contagem.value = await getStockCount(id)
  }, 'Não foi possível carregar a contagem')
}

async function loadItems() {
  await withLoading(async () => {
    const result = await listStockCountItems(id, {
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      situacao: situacao.value,
    })
    itens.value = result.data
    estados.value = {}
    applyMeta(result)
  }, 'Não foi possível carregar os produtos da contagem')
}

async function salvar(productId: string, countedQuantity: number | null) {
  const item = itens.value.find((linha) => linha.productId === productId)
  if (!item) return

  const eraContado = item.countedQuantity !== null
  estados.value[productId] = 'salvando'
  try {
    const salvo = await countStockCountItem(id, productId, countedQuantity)
    item.countedQuantity = salvo.countedQuantity
    item.countedAt = salvo.countedAt
    estados.value[productId] = 'salvo'

    // Ajusta o contador aqui em vez de recarregar a contagem: a barra de progresso precisa andar a
    // cada produto, e buscar o resumo inteiro a cada lançamento é requisição à toa dentro da loja.
    const agoraContado = salvo.countedQuantity !== null
    if (contagem.value && eraContado !== agoraContado) {
      const passo = agoraContado ? 1 : -1
      contagem.value.resumo.countedCount += passo
      contagem.value.resumo.pendingCount -= passo
    }
  } catch (error) {
    estados.value[productId] = 'erro'
    toastError(getApiErrorMessage(error, 'Não foi possível salvar a contagem deste produto'))
  }
}

async function mudarEtapa(acao: () => Promise<StockCount>, mensagem: string) {
  mudandoEtapa.value = true
  try {
    contagem.value = await acao()
    situacao.value = 'todos'
    reload(loadItems)
    toastSuccess(mensagem)
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível mudar a etapa da contagem'))
  } finally {
    mudandoEtapa.value = false
  }
}

async function conferir() {
  const pendentes = contagem.value?.resumo.pendingCount ?? 0
  const confirmado = await confirmAction({
    title: 'Conferir a contagem?',
    text:
      pendentes > 0
        ? `${pendentes} ${pendentes === 1 ? 'produto ainda não foi contado e ficará' : 'produtos ainda não foram contados e ficarão'} sem ajuste. O estoque ainda não muda agora.`
        : 'O sistema vai mostrar a diferença entre o que ele tinha e o que você contou. O estoque ainda não muda agora.',
    confirmButtonText: 'Conferir',
  })
  if (confirmado) await mudarEtapa(() => reviewStockCount(id), 'Contagem pronta para conferência')
}

async function voltarAContar() {
  await mudarEtapa(() => reopenStockCount(id), 'Contagem reaberta')
}

async function encerrar() {
  const resumo = contagem.value?.resumo
  if (!resumo) return

  const confirmado = await confirmAction({
    title: 'Ajustar o estoque com o que foi contado?',
    text: `${resumo.divergentCount} ${resumo.divergentCount === 1 ? 'produto será corrigido' : 'produtos serão corrigidos'}, saldo de ${formatCurrency(resumo.netValue)}. Isso não tem como desfazer de uma vez.`,
    confirmButtonText: 'Ajustar estoque',
  })
  if (confirmado) await mudarEtapa(() => finishStockCount(id), 'Estoque ajustado pela contagem')
}

async function handleCancel() {
  if (!cancelReason.value.trim()) {
    cancelErrors.value.cancelReason = 'Explique o motivo do cancelamento'
    return
  }

  cancelling.value = true
  try {
    contagem.value = await cancelStockCount(id, cancelReason.value.trim())
    cancelModalOpen.value = false
    situacao.value = 'todos'
    reload(loadItems)
    toastSuccess('Contagem cancelada sem mexer no estoque')
  } catch (error) {
    const result = resolveFormError(error, 'Não foi possível cancelar a contagem')
    cancelErrors.value = result.fieldErrors
    if (result.message) toastError(result.message)
  } finally {
    cancelling.value = false
  }
}

function abrirCancelamento() {
  cancelReason.value = ''
  clearCancelErrors()
  cancelModalOpen.value = true
}

onMounted(async () => {
  await loadCount()
  await loadItems()
})

watchSearch(search, loadItems)
watch(situacao, () => reload(loadItems))
</script>

<template>
  <div>
    <PageHeader
      :title="contagem ? `Contagem: ${escopoDaContagem(contagem.categoryName)}` : 'Contagem de estoque'"
      :subtitle="contagem ? `Iniciada em ${formatDateTime(contagem.startedAt)} por ${contagem.createdByUser?.name ?? 'usuário não identificado'}` : undefined"
    >
      <template #actions>
        <StockCountStatusBadge v-if="contagem" :status="contagem.status" />

        <template v-if="contagem && canManage && contagem.status === 'em_andamento'">
          <BaseButton :disabled="!podeConferir(contagem) || mudandoEtapa" @click="conferir">
            <Eye :size="16" /> Conferir contagem
          </BaseButton>
          <BaseButton variant="secondary" :disabled="mudandoEtapa" @click="abrirCancelamento">
            Cancelar contagem
          </BaseButton>
        </template>

        <template v-if="contagem && canManage && contagem.status === 'em_conferencia'">
          <BaseButton :disabled="mudandoEtapa" @click="encerrar">Ajustar estoque</BaseButton>
          <BaseButton variant="secondary" :disabled="mudandoEtapa" @click="voltarAContar">
            <EyeOff :size="16" /> Voltar a contar
          </BaseButton>
          <BaseButton variant="danger" :disabled="mudandoEtapa" @click="abrirCancelamento">
            Cancelar contagem
          </BaseButton>
        </template>

        <BaseButton variant="secondary" @click="router.push({ name: 'contagem' })">
          <ArrowLeft :size="16" /> Voltar
        </BaseButton>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

    <div
      v-if="contagem?.status === 'cancelada'"
      class="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
    >
      Contagem cancelada sem ajustar o estoque. Motivo: {{ contagem.cancelReason }}
    </div>

    <div
      v-if="contando"
      class="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <p class="mb-3 text-sm text-gray-600 dark:text-gray-300">
        Conte o que existe na banca e digite aqui. O sistema não mostra o saldo dele agora de propósito, para o número
        na tela não puxar a sua resposta. Cada quantidade é salva sozinha, então dá para parar e continuar depois.
      </p>
      <StockCountProgress
        :counted="contagem?.resumo.countedCount ?? 0"
        :total="contagem?.resumo.itemsCount ?? 0"
      />
    </div>

    <StockCountTotalsCards v-else-if="contagem?.revelada" class="mb-6" :resumo="contagem.resumo" />

    <div v-if="contagem" class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SearchInput v-model="search" placeholder="Buscar produto..." />
      <FilterChips
        :model-value="situacao"
        :options="filtros"
        @update:model-value="situacao = $event as SituacaoDoItem"
      />
    </div>

    <template v-if="contando">
      <p v-if="loading" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      <p v-else-if="itens.length === 0" class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        Nenhum produto neste filtro.
      </p>
      <ul v-else class="space-y-3">
        <StockCountItemCard
          v-for="item in itens"
          :key="item.productId"
          :item="item"
          :estado="estados[item.productId] ?? 'parado'"
          @save="salvar"
        />
      </ul>
      <div class="mt-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <Pagination v-bind="paginationProps" />
      </div>
      <p class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ textoDoProgresso(contagem?.resumo.countedCount ?? 0, contagem?.resumo.itemsCount ?? 0) }}
      </p>
    </template>

    <div v-else-if="contagem" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <StockCountReportTable :items="itens" :loading="loading" />
      <Pagination v-bind="paginationProps" />
    </div>

    <BaseModal :open="cancelModalOpen" title="Cancelar contagem" @close="cancelModalOpen = false">
      <form class="space-y-4" novalidate @submit.prevent="handleCancel">
        <p class="text-sm text-gray-600 dark:text-gray-300">
          O estoque não muda e o que já foi contado fica guardado no histórico. Para contar de novo você precisa abrir
          uma contagem nova.
        </p>
        <BaseInput
          v-model="cancelReason"
          label="Motivo do cancelamento"
          placeholder="Ex.: contamos a banca errada"
          :maxlength="LIMITES_TEXTO.motivo"
          :error="cancelErrors.cancelReason"
          required
        />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" type="button" @click="cancelModalOpen = false">Voltar</BaseButton>
          <BaseButton variant="danger" type="submit" :disabled="cancelling">
            {{ cancelling ? 'Cancelando...' : 'Cancelar contagem' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
