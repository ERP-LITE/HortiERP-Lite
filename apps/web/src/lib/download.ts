// Dois detalhes que já custaram download silenciosamente quebrado no celular: o link precisa estar
// no DOM na hora do clique, e o `revokeObjectURL` precisa ser adiado.
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
