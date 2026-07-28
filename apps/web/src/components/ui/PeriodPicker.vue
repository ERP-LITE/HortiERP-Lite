<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import DateInput from './DateInput.vue'
import { rangeForPreset, type PeriodPreset, type PeriodValue } from '@/lib/period'

const props = withDefaults(defineProps<{ modelValue: PeriodValue; includeAllTime?: boolean }>(), {
  includeAllTime: true,
})
const emit = defineEmits<{ 'update:modelValue': [value: PeriodValue] }>()

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

function selectPreset(preset: PeriodPreset) {
  if (preset === 'personalizado') {
    emit('update:modelValue', { preset, from: props.modelValue.from, to: props.modelValue.to })
    return
  }
  emit('update:modelValue', { preset, ...rangeForPreset(preset) })
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
    <ul class="space-y-1">
      <li v-for="option in options" :key="option.value">
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors"
          :class="
            modelValue.preset === option.value
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          "
          @click="selectPreset(option.value)"
        >
          {{ option.label }}
          <Check v-if="modelValue.preset === option.value" :size="16" />
        </button>
      </li>
    </ul>

    <div v-if="modelValue.preset === 'personalizado'" class="mt-3 grid grid-cols-2 gap-4">
      <DateInput :model-value="modelValue.from" label="De" @update:model-value="updateFrom" />
      <DateInput :model-value="modelValue.to" label="Até" @update:model-value="updateTo" />
    </div>
  </div>
</template>
