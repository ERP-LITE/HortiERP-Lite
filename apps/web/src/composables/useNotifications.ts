import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { mutacoesBemSucedidas } from '@/services/api'
import { fetchOperationalAlerts, type OperationalAlerts } from '@/services/notificationsService'
import { fetchBillingAlerts, type BillingAlerts } from '@/services/billingsService'

const INTERVALO_MS = 5 * 60 * 1000
const INTERVALO_MINIMO_ENTRE_CONSULTAS_MS = 60 * 1000

// Espera curta depois de uma gravação: junta a rajada de um fluxo com várias chamadas (importar
// planilha, excluir em massa) numa consulta só, sem atraso perceptível para uma gravação sozinha.
const ESPERA_APOS_GRAVACAO_MS = 700

/**
 * Estado do sino de alertas. O painel é um espelho da situação atual, não uma caixa de
 * entrada: nada é marcado como lido, e o alerta some sozinho quando o estoque é reposto
 * ou a cobrança é baixada.
 */
export function useNotifications() {
  const auth = useAuthStore()
  const operational = ref<OperationalAlerts | null>(null)
  const billing = ref<BillingAlerts | null>(null)
  const indisponivel = ref(false)

  let intervalo: ReturnType<typeof setInterval> | undefined
  let esperaAposGravacao: ReturnType<typeof setTimeout> | undefined
  let consultando = false
  let repetirAoTerminar = false
  let ultimaConsultaEm = 0

  const isPlataforma = computed(() => auth.user?.role === 'super_admin')
  const total = computed(() => (isPlataforma.value ? billing.value?.total : operational.value?.total) ?? 0)

  async function refresh(forcar = false) {
    if (!auth.user) return
    // Consulta forçada que chega com outra em andamento não pode ser descartada: ela existe
    // justamente porque o dado acabou de mudar, e a resposta em voo é a de antes da mudança.
    if (consultando) {
      repetirAoTerminar = repetirAoTerminar || forcar
      return
    }
    if (!forcar && document.visibilityState === 'hidden') return
    const agora = Date.now()
    if (!forcar && agora - ultimaConsultaEm < INTERVALO_MINIMO_ENTRE_CONSULTAS_MS) return

    consultando = true
    ultimaConsultaEm = agora
    try {
      if (isPlataforma.value) billing.value = await fetchBillingAlerts()
      else operational.value = await fetchOperationalAlerts()
      indisponivel.value = false
    } catch {
      // Alerta é informação secundária: falha aqui não pode virar aviso por cima do
      // trabalho de quem está lançando entrada ou perda.
      indisponivel.value = true
    } finally {
      consultando = false
    }

    if (repetirAoTerminar) {
      repetirAoTerminar = false
      await refresh(true)
    }
  }

  // Entrar ou sair da impersonação troca a origem dos alertas. Sem isto o sino ficaria com o
  // dado do contexto anterior até o próximo ciclo, logo no momento em que o usuário está olhando.
  watch(isPlataforma, () => void refresh(true))

  // Toda gravação pode mexer no alerta: repor estoque, lançar perda, ajustar, importar planilha,
  // baixar cobrança. Observar a gravação em si evita depender de cada tela lembrar de avisar o sino.
  watch(mutacoesBemSucedidas, () => {
    clearTimeout(esperaAposGravacao)
    esperaAposGravacao = setTimeout(() => void refresh(true), ESPERA_APOS_GRAVACAO_MS)
  })

  function aoVoltarParaAba() {
    if (document.visibilityState === 'visible') void refresh()
  }

  onMounted(() => {
    void refresh(true)
    intervalo = setInterval(() => void refresh(), INTERVALO_MS)
    window.addEventListener('focus', aoVoltarParaAba)
    document.addEventListener('visibilitychange', aoVoltarParaAba)
  })

  onBeforeUnmount(() => {
    clearInterval(intervalo)
    clearTimeout(esperaAposGravacao)
    window.removeEventListener('focus', aoVoltarParaAba)
    document.removeEventListener('visibilitychange', aoVoltarParaAba)
  })

  return { operational, billing, total, isPlataforma, indisponivel, refresh }
}
