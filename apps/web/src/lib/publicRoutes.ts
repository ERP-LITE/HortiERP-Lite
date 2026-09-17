/**
 * Caminhos que abrem sem sessão, duplicados do roteador de propósito: o interceptador de erros
 * precisa deles e não pode importar o roteador sem fechar um ciclo. Um teste compara as duas listas.
 */
export const CAMINHOS_PUBLICOS = [
  '/login',
  '/esqueci-senha',
  '/redefinir-senha',
  '/criar-conta',
  '/privacidade',
] as const

export function emCaminhoPublico(pathname: string) {
  return CAMINHOS_PUBLICOS.some((caminho) => pathname === caminho)
}
