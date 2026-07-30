import { computed, ref } from 'vue'

export function useBulkSelection(getVisibleIds: () => string[]) {
  const selectedIds = ref<string[]>([])

  const allVisibleSelected = computed(() => {
    const visibleIds = getVisibleIds()
    return visibleIds.length > 0 && visibleIds.every((id) => selectedIds.value.includes(id))
  })

  function toggleOne(id: string) {
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((selectedId) => selectedId !== id)
      : [...selectedIds.value, id]
  }

  function toggleAllVisible() {
    const visibleIds = getVisibleIds()
    selectedIds.value = allVisibleSelected.value ? [] : [...visibleIds]
  }

  function clearSelection() {
    selectedIds.value = []
  }

  return { selectedIds, allVisibleSelected, toggleOne, toggleAllVisible, clearSelection }
}
