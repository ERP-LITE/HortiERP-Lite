import { ref, toRaw } from 'vue'

export function useFilterModal<T>(createDefault: () => T, onApply: () => void) {
  const filters = ref<T>(createDefault())
  const draftFilters = ref<T>(createDefault())
  const filterModalOpen = ref(false)

  // structuredClone e não spread: filtro com objeto dentro (o período) compartilharia a referência,
  // e o rascunho passaria a alterar o filtro já aplicado
  const copiar = (valor: T) => structuredClone(toRaw(valor))

  function openFilterModal() {
    draftFilters.value = copiar(filters.value as T)
    filterModalOpen.value = true
  }

  function applyFilters() {
    filters.value = copiar(draftFilters.value as T)
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
