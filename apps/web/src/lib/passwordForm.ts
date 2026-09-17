import { LIMITES_TEXTO, SENHA_MIN } from '@/lib/limits'

/** Em bytes, e não em caracteres: o bcrypt corta no 72º byte e um acento ocupa dois. */
function tamanhoEmBytes(valor: string) {
  return new TextEncoder().encode(valor).length
}

/**
 * As frases são cópia literal das que a API devolveria: mudar o texto aqui faria o mesmo erro
 * parecer dois problemas diferentes conforme viesse da tela ou do servidor.
 */
export function validateNewPassword(
  novaSenha: string,
  confirmacao: string,
  fieldErrors: Record<string, string>,
) {
  if (!novaSenha) {
    fieldErrors.newPassword = 'Informe a nova senha'
  } else if (novaSenha.length < SENHA_MIN) {
    fieldErrors.newPassword = `Senha deve ter ao menos ${SENHA_MIN} caracteres`
  } else if (tamanhoEmBytes(novaSenha) > LIMITES_TEXTO.senha) {
    fieldErrors.newPassword = `Senha muito longa: use no máximo ${LIMITES_TEXTO.senha} caracteres`
  }

  if (!confirmacao) {
    fieldErrors.confirmPassword = 'Confirme a nova senha'
  } else if (novaSenha && novaSenha !== confirmacao) {
    fieldErrors.confirmPassword = 'A confirmação não confere com a nova senha'
  }
}
