<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import DashboardPanel from '@/components/dashboard/DashboardPanel.vue'
import { formatCurrency, formatPercent } from '@/lib/format'
import {
  shrinkageBarWidth,
  shrinkageStatus,
  shrinkageStatusLabels,
  shrinkageStatusVariants,
} from '@/lib/shrinkage'
import type { ShrinkageSummary } from '@/types'

const props = defineProps<{ data: ShrinkageSummary }>()

const status = computed(() => shrinkageStatus(props.data))
const barWidth = computed(() => shrinkageBarWidth(props.data))

const barTone = computed(() => {
  if (status.value === 'acima') return 'bg-red-500 dark:bg-red-400'
  if (status.value === 'atencao') return 'bg-amber-500 dark:bg-amber-400'
  return 'bg-green-500 dark:bg-green-400'
})

const valueTone = computed(() => {
  if (status.value === 'acima') return 'text-red-600 dark:text-red-400'
  if (status.value === 'atencao') return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-900 dark:text-gray-100'
})
</script>

<template>
  <DashboardPanel title="Quebra no período">
    <template #actions>
      <BaseBadge :variant="shrinkageStatusVariants[status]">{{ shrinkageStatusLabels[status] }}</BaseBadge>
    </template>

    <div class="p-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div class="sm:w-44 sm:shrink-0">
        <p class="text-3xl font-bold leading-none" :class="valueTone">
          {{ data.percent === null ? '--' : formatPercent(data.percent) }}
        </p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">do custo que entrou</p>
      </div>

      <div class="flex-1 min-w-0">
        <div
          class="relative h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-700"
          role="img"
          :aria-label="
            data.percent === null
              ? 'Sem entrada de mercadoria no período para calcular a quebra'
              : `Quebra de ${formatPercent(data.percent)}, meta de ${formatPercent(data.targetPercent, 0)}`
          "
        >
          <div class="h-full rounded-full transition-all" :class="barTone" :style="{ width: `${barWidth}%` }" />
          <div class="absolute inset-y-[-3px] left-2/3 w-px bg-gray-400 dark:bg-gray-500" />
        </div>
        <div class="relative mt-1.5 h-4 text-xs text-gray-500 dark:text-gray-400">
          <span class="absolute left-0">0%</span>
          <span class="absolute left-2/3 -translate-x-1/2 whitespace-nowrap">
            meta {{ formatPercent(data.targetPercent, 0) }}
          </span>
        </div>

        <p class="mt-3 text-sm text-gray-600 dark:text-gray-300">
          <template v-if="data.percent === null">
            Nenhuma entrada de mercadoria lançada no período, então não há sobre o que calcular a quebra.
          </template>
          <template v-else>
            {{ formatCurrency(data.lossValue) }} perdidos de {{ formatCurrency(data.entriesValue) }} que entraram.
          </template>
        </p>
      </div>
    </div>

    <p class="px-4 pb-4 text-xs text-gray-500 dark:text-gray-400">
      A meta de {{ formatPercent(data.targetPercent, 0) }} equivale aos 3% de quebra sobre faturamento que o SEBRAE
      recomenda, convertidos para custo. Aqui a conta é sobre o que entrou, porque o sistema não registra venda.
    </p>
  </DashboardPanel>
</template>
