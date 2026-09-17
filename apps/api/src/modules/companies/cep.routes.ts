import type { FastifyInstance } from 'fastify'
import { findAddressByCep } from './cep.service.js'

/**
 * Pública porque o cadastro que a própria loja preenche também consulta CEP. Não voltar para
 * `companies.routes.ts`: lá tudo exige `super_admin`, e o 401 aparece como sessão encerrada no meio
 * do cadastro. O freio existe porque cada chamada vira até três requisições a serviço de terceiro.
 */
export async function cepRoutes(app: FastifyInstance) {
  app.get<{ Params: { cep: string } }>(
    '/address/cep/:cep',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      return findAddressByCep(request.params.cep)
    },
  )
}
