<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCategoricalPalette } from './palette'
import type { LossReason } from '@/types'
import ChartTooltip from './ChartTooltip.vue'
import type { DashboardProductQuantity, DashboardQuantityByUnit } from '@/types'

const props = defineProps<{
  data: {
    reason: LossReason
    lossesCount: number
    totalsByUnit: DashboardQuantityByUnit[]
    products: DashboardProductQuantity[]
    otherProductsCount: number
  }[]
}>()

const palette = useCategoricalPalette()
const chartContainer = ref<HTMLElement | null>(null)
const tooltip = ref({ visible: false, x: 0, y: 0, title: '', label: '', value: '', color: '', details: [] as string[] })

const reasonLabels: Record<LossReason, string> = {
  vencido: 'Vencido',
  avariado: 'Avariado',
  roubo_furto: 'Roubo/Furto',
  erro_operacional: 'Erro operacional',
  outro: 'Outro',
}

const sorted = computed(() => {
  const max = Math.max(1, ...props.data.map((d) => d.lossesCount))
  return [...props.data]
    .sort((a, b) => b.lossesCount - a.lossesCount)
    .map((item) => ({ ...item, percent: (item.lossesCount / max) * 100 }))
})

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function showTooltip(event: MouseEvent | FocusEvent, item: (typeof sorted.value)[number], color: string) {
  const bounds = chartContainer.value?.getBoundingClientRect()
  if (!bounds) return
  const pointer = event instanceof MouseEvent
  tooltip.value = {
    visible: true,
    x: pointer ? Math.min(Math.max(event.clientX, 140), window.innerWidth - 140) : bounds.left + bounds.width / 2,
    y: pointer ? event.clientY : bounds.top + Math.max(bounds.height / 2, 76),
    title: reasonLabels[item.reason] ?? item.reason,
    label: 'Quantidade perdida',
    value: `${item.lossesCount} ${item.lossesCount === 1 ? 'registro' : 'registros'}`,
    color,
    details: buildDetails(item.totalsByUnit, item.products, item.otherProductsCount),
  }
}

// A API já corta a lista nos produtos de maior quantidade e informa quantos
// sobraram, então aqui é só montar as linhas.
function buildDetails(
  totals: DashboardQuantityByUnit[],
  products: DashboardProductQuantity[],
  otherProductsCount: number,
) {
  const lines = totals.map((item) => `Total: ${formatNumber(item.quantity)} ${item.unitAbbreviation}`)
  lines.push(...products.map((item) => `${item.productName}: ${formatNumber(item.quantity)} ${item.unitAbbreviation}`))
  if (otherProductsCount > 0) lines.push(`+ ${otherProductsCount} outros produtos`)
  return lines
}

function hideTooltip() {
  tooltip.value.visible = false
}
</script>

<template>
  <div ref="chartContainer" class="relative space-y-3">
    <p v-if="sorted.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
      Nenhuma perda no período selecionado.
    </p>
    <div v-for="(item, index) in sorted" :key="item.reason" class="space-y-1">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-700 dark:text-gray-300">{{ reasonLabels[item.reason] ?? item.reason }}</span>
        <span class="text-gray-500 dark:text-gray-400" style="font-variant-numeric: tabular-nums">
          {{ item.lossesCount }} {{ item.lossesCount === 1 ? 'registro' : 'registros' }}
        </span>
      </div>
      <div class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          class="h-full rounded-full"
          :style="{ width: `${item.percent}%`, backgroundColor: palette[index % palette.length] }"
          tabindex="0"
          role="img"
          :aria-label="`${reasonLabels[item.reason] ?? item.reason}: ${item.lossesCount} registros de perda`"
          @mouseenter="showTooltip($event, item, palette[index % palette.length])"
          @mousemove="showTooltip($event, item, palette[index % palette.length])"
          @mouseleave="hideTooltip"
          @focus="showTooltip($event, item, palette[index % palette.length])"
          @blur="hideTooltip"
        />
      </div>
    </div>
    <ChartTooltip v-bind="tooltip" />
  </div>
</template>
