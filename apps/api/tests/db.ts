import type { Database, Escopo } from '../src/db/client.js'
import { liberarEscopoDePlataforma, reservarEscopoDePlataforma } from '../src/db/scope.js'

let escopo: Escopo | undefined

export async function abrirDbDeTeste() {
  escopo = await reservarEscopoDePlataforma()
}

export async function fecharDbDeTeste() {
  const atual = escopo
  escopo = undefined
  if (atual) await liberarEscopoDePlataforma(atual)
}

/**
 * `db` dos testes: uma conexão em escopo de plataforma, resolvida na hora do uso. Os testes montam
 * fixture e conferem resultado lendo o banco direto, o que as políticas por empresa recusariam — e
 * isso é afordância de teste, não de produção, então não mora em `src/`. As requisições feitas por
 * `app.inject` abrem escopo próprio no hook e continuam sujeitas às políticas.
 */
export const db = new Proxy({} as Database, {
  get(_alvo, propriedade) {
    if (!escopo) throw new Error('db de teste usado fora do setup — chame setupTestApp().')
    const valor = Reflect.get(escopo.db as object, propriedade, escopo.db)
    return typeof valor === 'function' ? valor.bind(escopo.db) : valor
  },
})
