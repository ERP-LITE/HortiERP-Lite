import { computed, ref, type Ref } from 'vue'

export type SortOrder = 'asc' | 'desc'

export function useTableSort(reload: () => void | Promise<void>, defaultField?: string, defaultOrder: SortOrder = 'asc') {
  const sortBy = ref<string | undefined>(defaultField)
  const sortOrder = ref<SortOrder>(defaultOrder)

  function toggleSort(field: string) {
    if (sortBy.value === field) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    else {
      sortBy.value = field
      sortOrder.value = 'asc'
    }
    void reload()
  }

  return { sortBy, sortOrder, toggleSort }
}

export function useLocalTableSort<T>(items: Ref<T[]>, accessors: Record<string, (item: T) => unknown>, defaultField: string) {
  const sortBy = ref(defaultField)
  const sortOrder = ref<SortOrder>('asc')
  function toggleSort(field: string) {
    if (sortBy.value === field) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    else { sortBy.value = field; sortOrder.value = 'asc' }
  }
  const sortedItems = computed(() => [...items.value].sort((left, right) => {
    const a = accessors[sortBy.value]?.(left)
    const b = accessors[sortBy.value]?.(right)
    if (a == null) return b == null ? 0 : 1
    if (b == null) return -1
    const comparison = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' })
    return sortOrder.value === 'asc' ? comparison : -comparison
  }))
  return { sortBy, sortOrder, toggleSort, sortedItems }
}
