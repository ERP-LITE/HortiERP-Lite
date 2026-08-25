import 'fastify'
import type { Escopo } from '../db/client.js'

declare module 'fastify' {
  interface FastifyRequest {
    technicalError?: {
      code: string
      message: string
    }
    escopoDb?: Escopo
  }
}
