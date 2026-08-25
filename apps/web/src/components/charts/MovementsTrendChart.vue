<script setup lang="ts">
import { computed, ref } from 'vue'
import { STATUS_CRITICAL, STATUS_GOOD, STATUS_NEUTRAL, useChartInk } from './palette'
import ChartTooltip from './ChartTooltip.vue'
import type { DashboardProductQuantity, DashboardQuantityByUnit } from '@/types'
import { formatChartNumber } from '@/lib/format'

const props = defineProps<{
  data: {
    date: string
    entradaCount: number
    perdaCount: number
    ajusteCount: number
    entradaByUnit: DashboardQuantityByUnit[]
    perdaByUnit: DashboardQuantityByUnit[]
    ajusteByUnit: DashboardQuantityByUnit[]
    entradaProducts: DashboardProductQuantity[]
    entradaOtherProductsCount: number
    perdaProducts: DashboardProductQuantity[]
    perdaOtherProductsCount: number
    ajusteProducts: DashboardProductQuantity[]
    ajusteOtherProductsCount: number
  }[]
}>()

const ink = useChartInk()

const WIDTH = 700
const HEIGHT = 220
const MARGIN = { top: 10, right: 8, bottom: 24, left: 30 }
const CHART_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const CHART_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom

const maxValue = computed(() => {
  const values = props.data.flatMap((d) => [d.entradaCount, d.perdaCount, d.ajusteCount])
  const max = Math.max(1, ...values)
  return Math.ceil(max / 5) * 5
})

const ticks = computed(() => [0, maxValue.value / 2, maxValue.value])

const slotWidth = computed(() => CHART_WIDTH / Math.max(props.data.length, 1))
const labelStep = computed(() => Math.max(1, Math.ceil(props.data.length / 12)))
const chartContainer = ref<HTMLElement | null>(null)
const tooltip = ref({ visible: false, x: 0, y: 0, title: '', label: '', value: '', color: '', details: [] as string[] })

const bars = computed(() => {
  const gap = Math.min(3, slotWidth.value * 0.15)
  return props.data.map((day, index) => {
    const slotX = MARGIN.left + index * slotWidth.value
    const barWidth = (slotWidth.value - gap * 4) / 3
    const entradaHeight = (day.entradaCount / maxValue.value) * CHART_HEIGHT
    const perdaHeight = (day.perdaCount / maxValue.value) * CHART_HEIGHT
    const ajusteHeight = (day.ajusteCount / maxValue.value) * CHART_HEIGHT
    return {
      date: day.date,
      entradaCount: day.entradaCount,
      perdaCount: day.perdaCount,
      ajusteCount: day.ajusteCount,
      entradaByUnit: day.entradaByUnit,
      perdaByUnit: day.perdaByUnit,
      ajusteByUnit: day.ajusteByUnit,
      entradaProducts: day.entradaProducts,
      entradaOtherProductsCount: day.entradaOtherProductsCount,
      perdaProducts: day.perdaProducts,
      perdaOtherProductsCount: day.perdaOtherProductsCount,
      ajusteProducts: day.ajusteProducts,
      ajusteOtherProductsCount: day.ajusteOtherProductsCount,
      entradaX: slotX + gap,
      perdaX: slotX + gap * 2 + barWidth,
      ajusteX: slotX + gap * 3 + barWidth * 2,
      barWidth,
      entradaY: MARGIN.top + CHART_HEIGHT - entradaHeight,
      entradaHeight,
      perdaY: MARGIN.top + CHART_HEIGHT - perdaHeight,
      perdaHeight,
      ajusteY: MARGIN.top + CHART_HEIGHT - ajusteHeight,
      ajusteHeight,
      labelX: slotX + slotWidth.value / 2,
      showLabel: index % labelStep.value === 0,
    }
  })
})

function formatDayLabel(date: string) {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

function showTooltip(
  event: MouseEvent | FocusEvent,
  date: string,
  type: 'Entrada' | 'Perda' | 'Ajuste',
  count: number,
  quantities: DashboardQuantityByUnit[],
  products: DashboardProductQuantity[],
  otherProductsCount: number,
) {
  const bounds = chartContainer.value?.getBoundingClientRect()
  if (!bounds) return
  const pointer = event instanceof MouseEvent
  tooltip.value = {
    visible: true,
    x: pointer ? Math.min(Math.max(event.clientX, 140), window.innerWidth - 140) : bounds.left + bounds.width / 2,
    y: pointer ? event.clientY : bounds.top + 100,
    title: formatDayLabel(date),
    label: type,
    value: `${count} ${count === 1 ? 'movimentação' : 'movimentações'}`,
    color: type === 'Entrada' ? STATUS_GOOD : type === 'Perda' ? STATUS_CRITICAL : STATUS_NEUTRAL,
    details: buildDetails(quantities, products, otherProductsCount),
  }
}

function buildDetails(
  quantities: DashboardQuantityByUnit[],
  products: DashboardProductQuantity[],
  otherProductsCount: number,
) {
  const totals = quantities.map((item) => `Total: ${formatChartNumber(item.quantity)} ${item.unitAbbreviation}`)
  const productLines = products.map(
    (item) => `${item.productName}: ${formatChartNumber(item.quantity)} ${item.unitAbbreviation}`,
  )
  if (otherProductsCount > 0) productLines.push(`+ ${otherProductsCount} outros produtos`)
  return totals.length ? [...totals, ...productLines] : ['Nenhuma quantidade registrada']
}

function hideTooltip() {
  tooltip.value.visible = false
}
</script>

<template>
  <div ref="chartContainer" class="relative">
    <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: STATUS_GOOD }" /> Entradas
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: STATUS_CRITICAL }" /> Perdas
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: STATUS_NEUTRAL }" /> Ajustes
      </span>
    </div>

    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="w-full h-56">
      <g v-for="tick in ticks" :key="tick">
        <line
          :x1="MARGIN.left"
          :x2="WIDTH - MARGIN.right"
          :y1="MARGIN.top + CHART_HEIGHT - (tick / maxValue) * CHART_HEIGHT"
          :y2="MARGIN.top + CHART_HEIGHT - (tick / maxValue) * CHART_HEIGHT"
          :stroke="ink.grid"
          stroke-width="1"
        />
        <text
          :x="MARGIN.left - 6"
          :y="MARGIN.top + CHART_HEIGHT - (tick / maxValue) * CHART_HEIGHT"
          text-anchor="end"
          dominant-baseline="middle"
          :fill="ink.muted"
          style="font-size: 9px"
        >
          {{ formatChartNumber(tick) }}
        </text>
      </g>

      <g v-for="bar in bars" :key="bar.date">
        <rect
          :x="bar.entradaX"
          :y="bar.entradaY"
          :width="bar.barWidth"
          :height="Math.max(bar.entradaHeight, 0)"
          :fill="STATUS_GOOD"
          rx="2"
          class="cursor-pointer transition-opacity hover:opacity-80 focus:opacity-80 focus:outline-none"
          tabindex="0"
          role="img"
          :aria-label="`${formatDayLabel(bar.date)}, ${bar.entradaCount} movimentações de entrada`"
          @mouseenter="showTooltip($event, bar.date, 'Entrada', bar.entradaCount, bar.entradaByUnit, bar.entradaProducts, bar.entradaOtherProductsCount)"
          @mousemove="showTooltip($event, bar.date, 'Entrada', bar.entradaCount, bar.entradaByUnit, bar.entradaProducts, bar.entradaOtherProductsCount)"
          @mouseleave="hideTooltip"
          @focus="showTooltip($event, bar.date, 'Entrada', bar.entradaCount, bar.entradaByUnit, bar.entradaProducts, bar.entradaOtherProductsCount)"
          @blur="hideTooltip"
        />
        <rect
          :x="bar.ajusteX"
          :y="bar.ajusteY"
          :width="bar.barWidth"
          :height="Math.max(bar.ajusteHeight, 0)"
          :fill="STATUS_NEUTRAL"
          rx="2"
          class="cursor-pointer transition-opacity hover:opacity-80 focus:opacity-80 focus:outline-none"
          tabindex="0"
          role="img"
          :aria-label="`${formatDayLabel(bar.date)}, ${bar.ajusteCount} ajustes de estoque`"
          @mouseenter="showTooltip($event, bar.date, 'Ajuste', bar.ajusteCount, bar.ajusteByUnit, bar.ajusteProducts, bar.ajusteOtherProductsCount)"
          @mousemove="showTooltip($event, bar.date, 'Ajuste', bar.ajusteCount, bar.ajusteByUnit, bar.ajusteProducts, bar.ajusteOtherProductsCount)"
          @mouseleave="hideTooltip"
          @focus="showTooltip($event, bar.date, 'Ajuste', bar.ajusteCount, bar.ajusteByUnit, bar.ajusteProducts, bar.ajusteOtherProductsCount)"
          @blur="hideTooltip"
        />
        <rect
          :x="bar.perdaX"
          :y="bar.perdaY"
          :width="bar.barWidth"
          :height="Math.max(bar.perdaHeight, 0)"
          :fill="STATUS_CRITICAL"
          rx="2"
          class="cursor-pointer transition-opacity hover:opacity-80 focus:opacity-80 focus:outline-none"
          tabindex="0"
          role="img"
          :aria-label="`${formatDayLabel(bar.date)}, ${bar.perdaCount} movimentações de perda`"
          @mouseenter="showTooltip($event, bar.date, 'Perda', bar.perdaCount, bar.perdaByUnit, bar.perdaProducts, bar.perdaOtherProductsCount)"
          @mousemove="showTooltip($event, bar.date, 'Perda', bar.perdaCount, bar.perdaByUnit, bar.perdaProducts, bar.perdaOtherProductsCount)"
          @mouseleave="hideTooltip"
          @focus="showTooltip($event, bar.date, 'Perda', bar.perdaCount, bar.perdaByUnit, bar.perdaProducts, bar.perdaOtherProductsCount)"
          @blur="hideTooltip"
        />
        <text
          v-if="bar.showLabel"
          :x="bar.labelX"
          :y="HEIGHT - 6"
          text-anchor="middle"
          :fill="ink.muted"
          style="font-size: 9px"
        >
          {{ formatDayLabel(bar.date) }}
        </text>
      </g>
    </svg>
    <ChartTooltip v-bind="tooltip" />
  </div>
</template>
