import type { Database, Escopo } from '../src/db/client.js'
import { devolverEscopo, reservarEscopo } from '../src/db/scope.js'

let escopo: Escopo | undefined

export async function abrirDbDeTeste() {
  escopo = await reservarEscopo(null, true)
}

export async function fecharDbDeTeste() {
  const atual = escopo
  escopo = undefined
  if (atual) await devolverEscopo(atual)
}

// Conexão em escopo de plataforma para os testes montarem fixture e conferirem resultado. As
// requisições de `app.inject` abrem escopo próprio no hook e seguem sujeitas às políticas.
export const db = new Proxy({} as Database, {
  get(_alvo, propriedade) {
    if (!escopo) throw new Error('db de teste usado fora do setup — chame setupTestApp().')
    const valor = Reflect.get(escopo.db as object, propriedade, escopo.db)
    return typeof valor === 'function' ? valor.bind(escopo.db) : valor
  },
})
