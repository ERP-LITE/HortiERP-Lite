import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface DropdownOptions {
  /** Roda ao abrir, antes de o painel existir no DOM (medir o gatilho, buscar dado fresco). */
  onOpen?: () => void
  /** Painel posicionado à mão: recalcular enquanto aberto, em rolagem e redimensionamento. */
  onReposition?: () => void
}

/**
 * Menu que abre ancorado num botão do cabeçalho (o do usuário e o do sino de alertas).
 * Fecha ao clicar fora e com Esc; o `rootRef` precisa embrulhar o botão **e** o painel,
 * senão o clique no próprio botão conta como clique fora e o menu reabre a cada toque.
 */
export function useDropdown(options: DropdownOptions = {}) {
  const open = ref(false)
  const rootRef = ref<HTMLElement | null>(null)

  function close() {
    open.value = false
  }

  function toggle() {
    open.value = !open.value
    if (open.value) options.onOpen?.()
  }

  function handleClickOutside(event: MouseEvent) {
    if (rootRef.value && !rootRef.value.contains(event.target as Node)) close()
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }

  function reposicionar() {
    options.onReposition?.()
  }

  // `true` na captura: rolagem acontece em containers internos (o `main` tem overflow próprio),
  // e o evento de rolagem não sobe até `window`.
  watch(open, (aberto) => {
    if (!options.onReposition) return
    if (aberto) {
      window.addEventListener('resize', reposicionar)
      window.addEventListener('scroll', reposicionar, true)
    } else {
      window.removeEventListener('resize', reposicionar)
      window.removeEventListener('scroll', reposicionar, true)
    }
  })

  onMounted(() => {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
    window.removeEventListener('resize', reposicionar)
    window.removeEventListener('scroll', reposicionar, true)
  })

  return { open, rootRef, toggle, close }
}
