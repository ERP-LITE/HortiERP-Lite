import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      companyId: string
      role: 'admin' | 'gerente' | 'operador' | 'super_admin'
      realCompanyId?: string
    }
    user: {
      sub: string
      companyId: string
      role: 'admin' | 'gerente' | 'operador' | 'super_admin'
      realCompanyId?: string
      /** Em segundos, posto pelo próprio jwtSign. Comparado com `users.passwordChangedAt`. */
      iat: number
    }
  }
}
