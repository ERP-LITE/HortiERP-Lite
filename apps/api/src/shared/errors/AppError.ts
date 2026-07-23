export class AppError extends Error {
  statusCode: number
  code: string

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
  }

  static notFound(message = 'Recurso não encontrado') {
    return new AppError(message, 404, 'NOT_FOUND')
  }

  static unauthorized(message = 'Não autenticado') {
    return new AppError(message, 401, 'UNAUTHORIZED')
  }

  static forbidden(message = 'Sem permissão para executar esta ação') {
    return new AppError(message, 403, 'FORBIDDEN')
  }

  static conflict(message = 'Conflito de dados') {
    return new AppError(message, 409, 'CONFLICT')
  }
}
