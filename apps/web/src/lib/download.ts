/**
 * Entrega um arquivo para o navegador de quem está usando o sistema.
 *
 * Dois detalhes aqui parecem zelo desnecessário e não são — os dois já custaram download que
 * simplesmente não acontecia, e a correção estava aplicada em só um dos lugares que baixam arquivo:
 *
 * - O link precisa estar **dentro do documento** na hora do clique. Fora do DOM, o Firefox e o
 *   Safari do iPhone ignoram o `click()` sem erro nenhum no console.
 * - O `revokeObjectURL` é **adiado**. Revogar na linha seguinte ao clique derruba o endereço antes
 *   de o navegador terminar de ler o conteúdo; no desktop costuma dar tempo, no celular não.
 *
 * Como quase todo mundo usa o sistema pelo celular, no depósito, o caminho lento é o que manda.
 */
export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
