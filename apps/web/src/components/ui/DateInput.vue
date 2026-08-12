<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type CSSProperties } from 'vue'
import { Calendar, ChevronLeft, ChevronRight } from '@lucide/vue'
import { formatDateOnly, formatMonthYear } from '@/lib/format'
import { toISODate, todayIso } from '@/lib/period'

const props = defineProps<{ modelValue: string; label?: string; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const container = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const calendar = ref<HTMLElement | null>(null)
const open = ref(false)
const calendarStyle = ref<CSSProperties>({})

// Recalculado a cada abertura para uma aba deixada aberta não destacar o dia
// anterior depois da virada da meia-noite.
const today = ref(todayIso())

function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : null
}

function startOfMonth(value: string) {
  const date = dateFromIso(value) ?? new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

const visibleMonth = ref(startOfMonth(props.modelValue))

const formatted = computed(() => formatDateOnly(props.modelValue))
const monthTitle = computed(() => formatMonthYear(visibleMonth.value))
const calendarDays = computed(() => {
  const first = new Date(visibleMonth.value.getFullYear(), visibleMonth.value.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      iso: toISODate(date),
      currentMonth: date.getMonth() === visibleMonth.value.getMonth(),
    }
  })
})

function updatePosition() {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const width = Math.min(320, window.innerWidth - 16)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const openAbove = window.innerHeight - rect.bottom < 370 && rect.top > window.innerHeight - rect.bottom
  calendarStyle.value = {
    left: `${left}px`,
    width: `${width}px`,
    ...(openAbove ? { bottom: `${window.innerHeight - rect.top + 6}px` } : { top: `${rect.bottom + 6}px` }),
  }
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  today.value = todayIso()
  visibleMonth.value = startOfMonth(props.modelValue)
  await nextTick()
  updatePosition()
}

function moveMonth(amount: number) {
  visibleMonth.value = new Date(visibleMonth.value.getFullYear(), visibleMonth.value.getMonth() + amount, 1)
}

function selectDate(value: string) {
  emit('update:modelValue', value)
  open.value = false
}

function handleOutsideClick(event: MouseEvent) {
  const target = event.target as Node
  if (!container.value?.contains(target) && !calendar.value?.contains(target)) open.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', handleOutsideClick)
    document.addEventListener('keydown', handleKeydown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
  } else {
    document.removeEventListener('click', handleOutsideClick)
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('scroll', updatePosition, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <div ref="container" class="block">
    <span v-if="label" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ label }}</span>
    <button
      ref="trigger"
      type="button"
      class="app-field-trigger flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-left text-sm transition-colors hover:border-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
      :class="[
        formatted ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500',
        { '!border-red-400': error },
      ]"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <span>{{ formatted || 'dd/mm/aaaa' }}</span>
      <Calendar :size="16" class="text-gray-400 dark:text-gray-500" />
    </button>
    <span v-if="error" class="mt-1 block text-xs text-red-600 dark:text-red-400">{{ error }}</span>
  </div>

  <Teleport to="body">
    <div
      v-if="open"
      ref="calendar"
      :style="calendarStyle"
      class="fixed z-[60] rounded-xl border border-gray-200 bg-white p-3 shadow-xl ring-1 ring-black/5 dark:border-gray-600 dark:bg-gray-800 dark:ring-white/5"
      role="dialog"
      aria-label="Escolher data"
    >
      <div class="mb-3 flex items-center justify-between">
        <button type="button" class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" aria-label="Mês anterior" @click="moveMonth(-1)">
          <ChevronLeft :size="18" />
        </button>
        <strong class="text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">{{ monthTitle }}</strong>
        <button type="button" class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" aria-label="Próximo mês" @click="moveMonth(1)">
          <ChevronRight :size="18" />
        </button>
      </div>

      <div class="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        <span v-for="weekday in ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']" :key="weekday" class="py-1">{{ weekday }}</span>
      </div>
      <div class="mt-1 grid grid-cols-7 gap-1">
        <button
          v-for="day in calendarDays"
          :key="day.iso"
          type="button"
          class="aspect-square rounded-lg text-sm transition-colors"
          :class="[
            day.iso === modelValue
              ? 'bg-primary-600 font-semibold text-white shadow-sm hover:bg-primary-700'
              : day.iso === today
                ? 'bg-primary-50 font-semibold text-primary-700 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/50'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700',
            day.currentMonth ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600',
          ]"
          @click="selectDate(day.iso)"
        >
          {{ day.date.getDate() }}
        </button>
      </div>

      <div class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-700">
        <button type="button" class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" @click="selectDate('')">Limpar</button>
        <button type="button" class="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400" @click="selectDate(today)">Hoje</button>
      </div>
    </div>
  </Teleport>
</template>
