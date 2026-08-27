export type Genero = 'm' | 'f'

/** Artigo definido: `o` / `a` / `os` / `as`. */
export function artigo(genero: Genero, plural = false) {
  const base = genero === 'f' ? 'a' : 'o'
  return plural ? `${base}s` : base
}

/**
 * Flexiona um particípio ou adjetivo escrito no masculino singular ("excluído", "selecionado")
 * para o gênero e o número pedidos.
 */
export function flexionar(masculinoSingular: string, genero: Genero, plural = false) {
  const base = genero === 'f' ? masculinoSingular.replace(/o$/, 'a') : masculinoSingular
  return plural ? `${base}s` : base
}

export function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
