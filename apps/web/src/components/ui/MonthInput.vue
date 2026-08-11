<script setup lang="ts">
import { computed } from 'vue'
import BaseSelect from './BaseSelect.vue'

const props = defineProps<{
  modelValue: string
  label?: string
  error?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const monthOptions = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

const selectedYear = computed(() => props.modelValue.slice(0, 4))
const selectedMonth = computed(() => props.modelValue.slice(5, 7))
const currentYear = new Date().getFullYear()
const yearOptions = computed(() => {
  const years = new Set<number>()
  for (let year = currentYear - 5; year <= currentYear + 5; year += 1) years.add(year)
  if (selectedYear.value) years.add(Number(selectedYear.value))
  return [...years]
    .sort((a, b) => b - a)
    .map((year) => ({ value: String(year), label: String(year) }))
})

function updatePart(part: 'month' | 'year', value: string) {
  const year = part === 'year' ? value : selectedYear.value
  const month = part === 'month' ? value : selectedMonth.value
  if (year && month) emit('update:modelValue', `${year}-${month}`)
}
</script>

<template>
  <div>
    <span v-if="label" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ label }}</span>
    <div class="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
      <BaseSelect
        :model-value="selectedMonth"
        :options="monthOptions"
        :searchable="false"
        :invalid="Boolean(error)"
        placeholder="Mês"
        aria-label="Mês da competência"
        @update:model-value="updatePart('month', $event)"
      />
      <BaseSelect
        :model-value="selectedYear"
        :options="yearOptions"
        :searchable="false"
        :invalid="Boolean(error)"
        placeholder="Ano"
        aria-label="Ano da competência"
        @update:model-value="updatePart('year', $event)"
      />
    </div>
    <span v-if="error" class="mt-1 block text-xs text-red-600 dark:text-red-400">{{ error }}</span>
  </div>
</template>
