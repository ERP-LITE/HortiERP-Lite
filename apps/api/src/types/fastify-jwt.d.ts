import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      companyId: string
      role: 'admin' | 'gerente' | 'operador'
    }
    user: {
      sub: string
      companyId: string
      role: 'admin' | 'gerente' | 'operador'
    }
  }
}
