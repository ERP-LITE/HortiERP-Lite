import type { Subscription } from '@/services/subscriptionService'

/**
 * Zero é o último dia, não "acabou": o sistema ainda funciona, e "0 dias restantes" pareceria
 * defeito de contagem.
 */
export function textoDoContador(assinatura: Pick<Subscription, 'status' | 'diasRestantes' | 'bloqueada'>) {
  if (assinatura.status === 'cancelada') return 'Sua assinatura foi cancelada.'
  if (assinatura.status === 'atrasada') return 'Há uma mensalidade em aberto.'
  if (assinatura.status === 'ativa') return 'Sua assinatura está em dia.'

  const dias = assinatura.diasRestantes
  if (dias === null) return 'Você está no período de teste.'
  if (dias < 0) return 'Seu período de teste terminou.'
  if (dias === 0) return 'Hoje é o último dia do seu teste.'
  if (dias === 1) return 'Falta 1 dia de teste.'
  return `Faltam ${dias} dias de teste.`
}
