<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarDays, Check, ChevronDown } from '@lucide/vue'
import DateInput from './DateInput.vue'
import { rangeForPreset, type PeriodPreset, type PeriodValue } from '@/lib/period'

const props = withDefaults(defineProps<{ modelValue: PeriodValue; includeAllTime?: boolean }>(), {
  includeAllTime: true,
})
const emit = defineEmits<{ 'update:modelValue': [value: PeriodValue] }>()
const expanded = ref(false)

const allOptions: { value: PeriodPreset; label: string }[] = [
  { value: 'todos', label: 'Todos os períodos' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7dias', label: 'Últimos 7 dias' },
  { value: '30dias', label: 'Últimos 30 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'mesPassado', label: 'Último mês' },
  { value: 'personalizado', label: 'Personalizado' },
]

const options = computed(() => (props.includeAllTime ? allOptions : allOptions.filter((o) => o.value !== 'todos')))
const selectedOptionLabel = computed(
  () => allOptions.find((option) => option.value === props.modelValue.preset)?.label ?? 'Selecionar período',
)

function formatDate(value: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

const selectedPeriodLabel = computed(() => {
  if (props.modelValue.preset !== 'personalizado') return selectedOptionLabel.value
  if (!props.modelValue.from && !props.modelValue.to) return 'Período personalizado'

  const from = formatDate(props.modelValue.from)
  const to = formatDate(props.modelValue.to)
  if (from && to) return `${from} até ${to}`
  if (from) return `A partir de ${from}`
  return `Até ${to}`
})

function selectPreset(preset: PeriodPreset) {
  if (preset === 'personalizado') {
    emit('update:modelValue', { preset, from: props.modelValue.from, to: props.modelValue.to })
    return
  }
  emit('update:modelValue', { preset, ...rangeForPreset(preset) })
  expanded.value = false
}

function updateFrom(value: string) {
  emit('update:modelValue', { ...props.modelValue, preset: 'personalizado', from: value })
}

function updateTo(value: string) {
  emit('update:modelValue', { ...props.modelValue, preset: 'personalizado', to: value })
}
</script>

<template>
  <div>
    <span class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Período</span>
    <button
      type="button"
      class="flex w-full items-center gap-3 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-left text-sm text-gray-900 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-500"
      :aria-expanded="expanded"
      aria-haspopup="listbox"
      @click="expanded = !expanded"
    >
      <CalendarDays :size="17" class="shrink-0 text-gray-400 dark:text-gray-500" />
      <span class="min-w-0 flex-1 truncate">{{ selectedPeriodLabel }}</span>
      <ChevronDown
        :size="16"
        class="shrink-0 text-gray-400 transition-transform dark:text-gray-500"
        :class="{ 'rotate-180': expanded }"
      />
    </button>

    <div
      v-if="expanded"
      class="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/50"
    >
      <ul class="grid grid-cols-1 gap-1 sm:grid-cols-2" role="listbox" aria-label="Opções de período">
        <li v-for="option in options" :key="option.value">
          <button
            type="button"
            role="option"
            class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors"
            :aria-selected="modelValue.preset === option.value"
            :class="
              modelValue.preset === option.value
                ? 'bg-primary-600 text-white'
                : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
            "
            @click="selectPreset(option.value)"
          >
            {{ option.label }}
            <Check v-if="modelValue.preset === option.value" :size="16" />
          </button>
        </li>
      </ul>

      <div
        v-if="modelValue.preset === 'personalizado'"
        class="mt-3 grid grid-cols-1 gap-3 border-t border-gray-200 px-1 pt-3 dark:border-gray-700 sm:grid-cols-2"
      >
        <DateInput :model-value="modelValue.from" label="De" @update:model-value="updateFrom" />
        <DateInput :model-value="modelValue.to" label="Até" @update:model-value="updateTo" />
      </div>
    </div>
  </div>
</template>
