<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCategoricalPalette, useChartInk } from './palette'
import ChartTooltip from './ChartTooltip.vue'
import type { DashboardProductQuantity, DashboardQuantityByUnit } from '@/types'

const props = defineProps<{
  data: {
    label: string
    value: number
    totalsByUnit: DashboardQuantityByUnit[]
    products: DashboardProductQuantity[]
    otherProductsCount: number
  }[]
}>()

const palette = useCategoricalPalette()
const ink = useChartInk()

const RADIUS = 70
const STROKE = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const total = computed(() => props.data.reduce((sum, item) => sum + item.value, 0))
const chartContainer = ref<HTMLElement | null>(null)
const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  label: '',
  value: '',
  color: '',
  detail: '',
  details: [] as string[],
})

const segments = computed(() => {
  let cumulative = 0
  return props.data.map((item, index) => {
    const fraction = total.value > 0 ? item.value / total.value : 0
    const dash = fraction * CIRCUMFERENCE
    const offset = -cumulative * CIRCUMFERENCE
    cumulative += fraction
    return {
      ...item,
      color: palette[index % palette.length],
      fraction,
      dash,
      offset,
    }
  })
})

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function showTooltip(event: MouseEvent | FocusEvent, segment: (typeof segments.value)[number]) {
  const bounds = chartContainer.value?.getBoundingClientRect()
  if (!bounds) return
  const pointer = event instanceof MouseEvent
  tooltip.value = {
    visible: true,
    x: pointer ? Math.min(Math.max(event.clientX, 140), window.innerWidth - 140) : bounds.left + bounds.width / 2,
    y: pointer ? event.clientY : bounds.top + 90,
    title: segment.label,
    label: 'Em estoque',
    value: `${segment.value} ${segment.value === 1 ? 'produto' : 'produtos'}`,
    color: segment.color,
    detail: `${(segment.fraction * 100).toFixed(1)}% dos produtos em estoque`,
    details: buildDetails(segment.totalsByUnit, segment.products, segment.otherProductsCount),
  }
}

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
  <div ref="chartContainer" class="relative flex flex-col items-center gap-6">
    <svg viewBox="0 0 200 200" class="w-40 h-40 shrink-0 -rotate-90">
      <circle
        v-if="segments.length === 0"
        cx="100"
        cy="100"
        :r="RADIUS"
        fill="none"
        :stroke="ink.grid"
        :stroke-width="STROKE"
      />
      <circle
        v-for="segment in segments"
        :key="segment.label"
        cx="100"
        cy="100"
        :r="RADIUS"
        fill="none"
        :stroke="segment.color"
        :stroke-width="STROKE"
        :stroke-dasharray="`${segment.dash} ${CIRCUMFERENCE - segment.dash}`"
        :stroke-dashoffset="segment.offset"
        stroke-linecap="butt"
        class="cursor-pointer transition-opacity hover:opacity-80 focus:opacity-80 focus:outline-none"
        tabindex="0"
        role="img"
        :aria-label="`${segment.label}: ${segment.value} produtos, ${(segment.fraction * 100).toFixed(1)}% dos produtos em estoque`"
        @mouseenter="showTooltip($event, segment)"
        @mousemove="showTooltip($event, segment)"
        @mouseleave="hideTooltip"
        @focus="showTooltip($event, segment)"
        @blur="hideTooltip"
      />
      <text
        x="100"
        y="100"
        text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(90 100 100)"
        class="fill-gray-900 dark:fill-gray-100"
        style="font-size: 22px; font-weight: 700"
      >
        {{ formatNumber(total) }}
      </text>
    </svg>

    <ul class="w-full space-y-2 text-sm">
      <li v-if="segments.length === 0" class="text-gray-500 dark:text-gray-400">Sem dados de estoque.</li>
      <li v-for="segment in segments" :key="segment.label" class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full shrink-0" :style="{ backgroundColor: segment.color }" />
        <span class="text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">{{ segment.label }}</span>
        <span class="text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {{ segment.value }} prod. · {{ (segment.fraction * 100).toFixed(0) }}%
        </span>
      </li>
    </ul>
    <ChartTooltip v-bind="tooltip" />
  </div>
</template>
