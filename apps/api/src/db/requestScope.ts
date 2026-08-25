import type { FastifyInstance } from 'fastify'
import { escopoAtual } from './client.js'
import { abrirEscopoDaRequisicao, fecharEscopoDaRequisicao } from './scope.js'

// Registrar depois do hook de log: `onResponse` corre na ordem de registro e o log escreve no banco.
export function registerRequestScope(app: FastifyInstance) {
  app.addHook('onRequest', (request, _reply, done) => {
    abrirEscopoDaRequisicao().then(
      (escopo) => {
        request.escopoDb = escopo
        // `done` dentro do `run` é o que leva o contexto para o resto do ciclo da requisição.
        escopoAtual.run(escopo, done)
      },
      (erro) => done(erro as Error),
    )
  })

  const devolver = async (request: { escopoDb?: Parameters<typeof fecharEscopoDaRequisicao>[0] }) => {
    const escopo = request.escopoDb
    if (!escopo) return
    request.escopoDb = undefined
    await fecharEscopoDaRequisicao(escopo)
  }

  app.addHook('onResponse', devolver)
  // Requisição abortada pelo cliente não passa pelo `onResponse`: sem isto a conexão ficaria presa.
  app.addHook('onRequestAbort', devolver)
}
