<script setup lang="ts">
import { computed } from 'vue'
import { useCategoricalPalette } from './palette'
import type { LossReason } from '@/types'

const props = defineProps<{
  data: { reason: LossReason; quantity: number }[]
}>()

const palette = useCategoricalPalette()

const reasonLabels: Record<LossReason, string> = {
  vencido: 'Vencido',
  avariado: 'Avariado',
  roubo_furto: 'Roubo/Furto',
  erro_operacional: 'Erro operacional',
  outro: 'Outro',
}

const sorted = computed(() => {
  const max = Math.max(1, ...props.data.map((d) => d.quantity))
  return [...props.data]
    .sort((a, b) => b.quantity - a.quantity)
    .map((item) => ({ ...item, percent: (item.quantity / max) * 100 }))
})

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="sorted.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
      Nenhuma perda no período selecionado.
    </p>
    <div v-for="(item, index) in sorted" :key="item.reason" class="space-y-1">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-700 dark:text-gray-300">{{ reasonLabels[item.reason] ?? item.reason }}</span>
        <span class="text-gray-500 dark:text-gray-400" style="font-variant-numeric: tabular-nums">
          {{ formatNumber(item.quantity) }}
        </span>
      </div>
      <div class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          class="h-full rounded-full"
          :style="{ width: `${item.percent}%`, backgroundColor: palette[index % palette.length] }"
        />
      </div>
    </div>
  </div>
</template>
