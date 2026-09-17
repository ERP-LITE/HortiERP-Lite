<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Check, RotateCcw } from '@lucide/vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { LIMITES_NUMERO } from '@/lib/limits'
import type { EstadoDoLancamento } from '@/lib/stockCount'
import type { StockCountItem } from '@/types'

const props = defineProps<{ item: StockCountItem; estado: EstadoDoLancamento }>()
const emit = defineEmits<{ save: [productId: string, countedQuantity: number | null] }>()

/**
 * Espera a pessoa parar de digitar antes de gravar. Sem isso cada dígito viraria uma requisição, e
 * "14" chegaria ao servidor como 1 e depois como 14, deixando o valor errado se a segunda falhar.
 */
const ESPERA_ATE_GRAVAR = 700

const valor = ref(props.item.countedQuantity ?? '')
let timer: ReturnType<typeof setTimeout> | undefined

// Recarga da lista e desfazer vindo de fora só podem sobrescrever o campo enquanto ninguém digita.
watch(
  () => props.item.countedQuantity,
  (novo) => {
    if (timer === undefined) valor.value = novo ?? ''
  },
)

function agendarGravacao() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    emit('save', props.item.productId, valor.value === '' ? null : Number(valor.value))
  }, ESPERA_ATE_GRAVAR)
}

function gravarAgora() {
  if (timer === undefined) return
  clearTimeout(timer)
  timer = undefined
  emit('save', props.item.productId, valor.value === '' ? null : Number(valor.value))
}

function tentarDeNovo() {
  emit('save', props.item.productId, valor.value === '' ? null : Number(valor.value))
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <li class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.productName }}</p>
        <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
          {{ item.categoryName }} · em {{ item.unitAbbreviation }}
        </p>
      </div>

      <div class="shrink-0 sm:w-40">
        <BaseInput
          v-model="valor"
          :decimal-places="3"
          :max="LIMITES_NUMERO.quantidade"
          placeholder="0,000"
          :aria-label="`Quantidade contada de ${item.productName}`"
          @update:model-value="agendarGravacao"
          @blur="gravarAgora"
        />
      </div>
    </div>

    <p v-if="estado === 'salvando'" class="mt-2 text-xs text-gray-500 dark:text-gray-400">Salvando...</p>
    <p v-else-if="estado === 'salvo'" class="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
      <Check :size="14" /> Salvo
    </p>
    <button
      v-else-if="estado === 'erro'"
      type="button"
      class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
      @click="tentarDeNovo"
    >
      <RotateCcw :size="14" /> Não salvou. Tentar de novo
    </button>
  </li>
</template>
