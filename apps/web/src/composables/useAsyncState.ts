import { ref } from 'vue'
import { getApiErrorMessage } from '@/services/api'

/**
 * Estado de carga e erro de uma tela. `withLoading` é para a carga principal; `captureError` é para
 * as cargas de apoio (opções de select), que rodam em paralelo com ela e apagariam o indicador antes
 * de a lista terminar se também mexessem no `loading`.
 */
export function useAsyncState() {
  const loading = ref(true)
  const errorMessage = ref('')

  async function withLoading(action: () => Promise<void>, fallbackMessage?: string) {
    loading.value = true
    // Limpa antes de tentar de novo: sem isso o aviso de falha fica na tela depois de uma recarga
    // bem-sucedida, e o usuário vê erro sobre uma lista que já carregou.
    errorMessage.value = ''
    try {
      await action()
    } catch (error) {
      errorMessage.value = getApiErrorMessage(error, fallbackMessage)
    } finally {
      loading.value = false
    }
  }

  async function captureError(action: () => Promise<void>, fallbackMessage?: string) {
    try {
      await action()
    } catch (error) {
      errorMessage.value = getApiErrorMessage(error, fallbackMessage)
    }
  }

  return { loading, errorMessage, withLoading, captureError }
}
