import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Breakpoint que o sistema trata como "mobile": abaixo do `sm` do Tailwind, o mesmo
 * limite usado pelo `v-mobile-accordion` e pelas classes `hidden sm:table-cell`.
 */
const DESKTOP_QUERY = '(min-width: 640px)'

/**
 * Reativo ao redimensionamento e à rotação da tela, para o caso de o usuário girar o
 * celular com um modal aberto.
 */
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
