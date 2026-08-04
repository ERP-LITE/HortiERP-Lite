<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ChevronDown, Search } from '@lucide/vue'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  required?: boolean
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
  searchable?: boolean
}>(), {
  searchable: true,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const container = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const open = ref(false)
const search = ref('')
const highlightedIndex = ref(0)
const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue))
const filteredOptions = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('pt-BR')
  return term
    ? props.options.filter((option) => option.label.toLocaleLowerCase('pt-BR').includes(term))
    : props.options
})

function closeDropdown() {
  open.value = false
  search.value = ''
}

async function toggleDropdown() {
  if (open.value) return closeDropdown()
  open.value = true
  highlightedIndex.value = Math.max(
    0,
    props.options.findIndex((option) => option.value === props.modelValue),
  )
  await nextTick()
  searchInput.value?.focus()
}

function selectOption(value: string) {
  emit('update:modelValue', value)
  closeDropdown()
}

function handleOutsideClick(event: MouseEvent) {
  if (!container.value?.contains(event.target as Node)) closeDropdown()
}

function moveHighlight(direction: 1 | -1) {
  if (!filteredOptions.value.length) return
  highlightedIndex.value =
    (highlightedIndex.value + direction + filteredOptions.value.length) % filteredOptions.value.length
}

function selectHighlighted() {
  const option = filteredOptions.value[highlightedIndex.value]
  if (option) selectOption(option.value)
}

watch(search, () => {
  highlightedIndex.value = 0
})
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('click', handleOutsideClick)
  else document.removeEventListener('click', handleOutsideClick)
})
watch(() => props.searchable, (searchable) => {
  if (!searchable) closeDropdown()
})
onBeforeUnmount(() => document.removeEventListener('click', handleOutsideClick))
</script>

<template>
  <div ref="container" class="relative block">
    <span v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ label }}</span>
    <div v-if="!searchable" class="relative">
      <select
        :value="modelValue"
        :required="required"
        class="w-full appearance-none rounded-lg border border-gray-300 pl-3.5 pr-10 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
        :class="{ 'border-red-400': error }"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>{{ placeholder ?? 'Selecione...' }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <ChevronDown
        :size="16"
        class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
      />
    </div>

    <template v-else>
      <button
        type="button"
        class="flex w-full items-center rounded-lg border border-gray-300 bg-white py-2.5 pl-3.5 pr-3 text-left text-sm text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-500"
        :class="{ 'border-red-400': error }"
        :aria-expanded="open"
        aria-haspopup="listbox"
        @click="toggleDropdown"
        @keydown.esc.prevent="closeDropdown"
      >
        <span
          class="min-w-0 flex-1 truncate"
          :class="{ 'text-gray-400 dark:text-gray-500': !selectedOption }"
        >
          {{ selectedOption?.label ?? placeholder ?? 'Selecione...' }}
        </span>
        <ChevronDown :size="16" class="ml-2 shrink-0 text-gray-400 transition-transform" :class="{ 'rotate-180': open }" />
      </button>
      <input
        v-if="required"
        :value="modelValue"
        required
        tabindex="-1"
        aria-hidden="true"
        class="pointer-events-none absolute h-px w-px opacity-0"
      />

      <div
        v-if="open"
        class="relative z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-gray-600 dark:bg-gray-800 dark:ring-white/5"
      >
        <div class="border-b border-gray-100 p-2 dark:border-gray-700">
          <div class="relative">
            <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref="searchInput"
              v-model="search"
              type="search"
              placeholder="Buscar..."
              class="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              @keydown.down.prevent="moveHighlight(1)"
              @keydown.up.prevent="moveHighlight(-1)"
              @keydown.enter.prevent="selectHighlighted"
              @keydown.esc.prevent="closeDropdown"
            />
          </div>
        </div>
        <ul class="app-modal-scrollbar max-h-48 overflow-y-auto overscroll-contain py-1" role="listbox">
          <li v-if="filteredOptions.length === 0" class="px-3 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
            Nenhuma opção encontrada
          </li>
          <li v-for="(option, index) in filteredOptions" :key="option.value">
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-gray-700 transition-colors dark:text-gray-200"
              :class="
                index === highlightedIndex
                  ? 'bg-primary-50 text-primary-700 dark:bg-gray-700 dark:text-primary-300'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
              "
              role="option"
              :aria-selected="modelValue === option.value"
              @mouseenter="highlightedIndex = index"
              @click="selectOption(option.value)"
            >
              <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
              <Check v-if="modelValue === option.value" :size="16" class="shrink-0 text-primary-600" />
            </button>
          </li>
        </ul>
      </div>
    </template>
    <span v-if="error" class="block text-xs text-red-600 mt-1">{{ error }}</span>
  </div>
</template>
