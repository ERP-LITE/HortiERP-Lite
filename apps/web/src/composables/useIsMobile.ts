import { onBeforeUnmount, onMounted, ref } from 'vue'

const DESKTOP_QUERY = '(min-width: 640px)'

export function useIsMobile() {
  const query = window.matchMedia(DESKTOP_QUERY)
  const isMobile = ref(!query.matches)

  function update(event: MediaQueryListEvent | MediaQueryList) {
    isMobile.value = !event.matches
  }

  onMounted(() => query.addEventListener('change', update))
  onBeforeUnmount(() => query.removeEventListener('change', update))

  return isMobile
}
