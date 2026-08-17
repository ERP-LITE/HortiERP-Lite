import { ref } from 'vue'

export function useFilterModal<T>(createDefault: () => T, onApply: () => void) {
  const filters = ref<T>(createDefault())
  const draftFilters = ref<T>(createDefault())
  const filterModalOpen = ref(false)

  function openFilterModal() {
    draftFilters.value = { ...filters.value }
    filterModalOpen.value = true
  }

  function applyFilters() {
    filters.value = { ...draftFilters.value }
    filterModalOpen.value = false
    onApply()
  }

  function clearFilters() {
    filters.value = createDefault()
    draftFilters.value = createDefault()
    filterModalOpen.value = false
    onApply()
  }

  return { filters, draftFilters, filterModalOpen, openFilterModal, applyFilters, clearFilters }
}
