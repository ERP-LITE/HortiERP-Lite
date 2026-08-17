<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'
import { formatInputMask, type InputMask } from '@/lib/format'

const props = defineProps<{
  modelValue: string | number | null | undefined
  label?: string
  type?: string
  placeholder?: string
  required?: boolean
  error?: string
  invalid?: boolean
  step?: string
  decimalPlaces?: number
  mask?: InputMask
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const showPassword = ref(false)
const inputElement = ref<HTMLInputElement | null>(null)
const isPassword = computed(() => props.type === 'password')
const isDecimal = computed(() => props.decimalPlaces !== undefined)
const isMasked = computed(() => props.mask !== undefined)
const resolvedType = computed(() => {
  if (isDecimal.value) return 'text'
  if (!isPassword.value) return props.type ?? 'text'
  return showPassword.value ? 'text' : 'password'
})

const displayValue = computed(() => {
  if (isMasked.value) return formatInputMask(String(props.modelValue ?? ''), props.mask!)
  if (!isDecimal.value || props.modelValue === null || props.modelValue === undefined || props.modelValue === '') {
    return props.modelValue ?? ''
  }

  const value = Number(String(props.modelValue).replace(',', '.'))
  if (!Number.isFinite(value)) return ''

  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: props.decimalPlaces,
    maximumFractionDigits: props.decimalPlaces,
  })
})

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement
  if (isMasked.value) {
    emit('update:modelValue', formatInputMask(input.value, props.mask!))
    return
  }
  if (!isDecimal.value) {
    emit('update:modelValue', input.value)
    return
  }

  const digits = input.value.replace(/\D/g, '')
  if (!digits) {
    emit('update:modelValue', '')
    return
  }

  const places = props.decimalPlaces ?? 2
  const normalized = digits.padStart(places + 1, '0')
  const integerPart = normalized.slice(0, -places).replace(/^0+(?=\d)/, '') || '0'
  const decimalPart = normalized.slice(-places)
  emit('update:modelValue', places > 0 ? `${integerPart}.${decimalPart}` : integerPart)
}

defineExpose({
  focus: () => inputElement.value?.focus(),
})
</script>

<template>
  <label class="block">
    <span v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ label }}</span>
    <div class="relative">
      <input
        ref="inputElement"
        :value="displayValue"
        :type="resolvedType"
        :inputmode="isDecimal || isMasked ? 'numeric' : undefined"
        :placeholder="placeholder"
        :required="required"
        :step="step"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500"
        :class="[{ 'border-red-400': error || invalid }, isPassword ? 'pr-10' : '']"
        @input="handleInput"
      />
      <button
        v-if="isPassword"
        type="button"
        tabindex="-1"
        class="absolute right-0 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        :title="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
        @click="showPassword = !showPassword"
      >
        <EyeOff v-if="showPassword" :size="16" />
        <Eye v-else :size="16" />
      </button>
    </div>
    <span v-if="error" class="mt-1 block text-xs text-red-600 dark:text-red-400">{{ error }}</span>
  </label>
</template>
