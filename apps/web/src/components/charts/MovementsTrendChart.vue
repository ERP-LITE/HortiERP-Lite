<script setup lang="ts">
import { computed } from 'vue'
import { STATUS_CRITICAL, STATUS_GOOD, useChartInk } from './palette'

const props = defineProps<{
  data: { date: string; entrada: number; perda: number }[]
}>()

const ink = useChartInk()

const WIDTH = 700
const HEIGHT = 220
const MARGIN = { top: 10, right: 8, bottom: 24, left: 30 }
const CHART_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const CHART_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom

const maxValue = computed(() => {
  const values = props.data.flatMap((d) => [d.entrada, d.perda])
  const max = Math.max(1, ...values)
  return Math.ceil(max / 5) * 5
})

const ticks = computed(() => [0, maxValue.value / 2, maxValue.value])

const slotWidth = computed(() => CHART_WIDTH / Math.max(props.data.length, 1))

const bars = computed(() => {
  const gap = 3
  return props.data.map((day, index) => {
    const slotX = MARGIN.left + index * slotWidth.value
    const barWidth = (slotWidth.value - gap * 3) / 2
    const entradaHeight = (day.entrada / maxValue.value) * CHART_HEIGHT
    const perdaHeight = (day.perda / maxValue.value) * CHART_HEIGHT
    return {
      date: day.date,
      entrada: day.entrada,
      perda: day.perda,
      entradaX: slotX + gap,
      perdaX: slotX + gap * 2 + barWidth,
      barWidth,
      entradaY: MARGIN.top + CHART_HEIGHT - entradaHeight,
      entradaHeight,
      perdaY: MARGIN.top + CHART_HEIGHT - perdaHeight,
      perdaHeight,
      labelX: slotX + slotWidth.value / 2,
      showLabel: props.data.length <= 10 || index % 2 === 0,
    }
  })
})

function formatDayLabel(date: string) {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
</script>

<template>
  <div>
    <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: STATUS_GOOD }" /> Entradas
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: STATUS_CRITICAL }" /> Perdas
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
          {{ formatNumber(tick) }}
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
        >
          <title>{{ formatDayLabel(bar.date) }} — Entradas: {{ formatNumber(bar.entrada) }}</title>
        </rect>
        <rect
          :x="bar.perdaX"
          :y="bar.perdaY"
          :width="bar.barWidth"
          :height="Math.max(bar.perdaHeight, 0)"
          :fill="STATUS_CRITICAL"
          rx="2"
        >
          <title>{{ formatDayLabel(bar.date) }} — Perdas: {{ formatNumber(bar.perda) }}</title>
        </rect>
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
  </div>
</template>
