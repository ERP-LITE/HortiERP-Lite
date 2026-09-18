import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AppError } from '../errors/AppError.js'

const uuid = z.string().uuid()
const PARAMETROS_DE_RECURSO = new Set(['id', 'productId', 'attachmentId'])

/** Valida os identificadores depois da autenticação e das permissões da rota. */
export function registerResourceParams(app: FastifyInstance) {
  app.addHook('onRoute', (route) => {
    const nomes = [...route.url.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1])
      .filter((nome) => PARAMETROS_DE_RECURSO.has(nome))
    if (nomes.length === 0) return

    const anteriores = route.preHandler
      ? Array.isArray(route.preHandler) ? route.preHandler : [route.preHandler]
      : []
    route.preHandler = [...anteriores, async (request) => {
      const params = request.params as Record<string, unknown>
      if (nomes.some((nome) => !uuid.safeParse(params[nome]).success)) {
        throw AppError.notFound('Recurso não encontrado')
      }
    }]
  })
}
