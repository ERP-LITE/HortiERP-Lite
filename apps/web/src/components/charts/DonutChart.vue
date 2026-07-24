<script setup lang="ts">
import { computed } from 'vue'
import { useCategoricalPalette, useChartInk } from './palette'

const props = defineProps<{
  data: { label: string; value: number }[]
}>()

const palette = useCategoricalPalette()
const ink = useChartInk()

const RADIUS = 70
const STROKE = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const total = computed(() => props.data.reduce((sum, item) => sum + item.value, 0))

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
</script>

<template>
  <div class="flex flex-col items-center gap-6">
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
      >
        <title>{{ segment.label }}: {{ formatNumber(segment.value) }} ({{ (segment.fraction * 100).toFixed(1) }}%)</title>
      </circle>
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
          {{ formatNumber(segment.value) }} · {{ (segment.fraction * 100).toFixed(0) }}%
        </span>
      </li>
    </ul>
  </div>
</template>
