import { ref } from 'vue'

/**
 * Lógica compartilhada de abrir/aplicar/limpar com estado rascunho por trás de todo
 * modal de filtro do sistema. `onApply` roda depois que filters/clearFilters commitam
 * — quem chama é responsável por resetar página + recarregar, já que isso varia por tela.
 */
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
