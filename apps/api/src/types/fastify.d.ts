import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    technicalError?: {
      code: string
      message: string
    }
  }
}
