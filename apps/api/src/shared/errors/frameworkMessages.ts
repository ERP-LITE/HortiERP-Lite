import { env } from '../config/env.js'

export function fileTooLargeMessage() {
  return `O arquivo excede o limite de ${Math.floor(env.INVOICE_MAX_FILE_SIZE / 1024 / 1024)} MB`
}

const FRAMEWORK_MESSAGES: Record<string, string | (() => string)> = {
  FST_ERR_CTP_EMPTY_JSON_BODY: 'Envie os dados da requisição no corpo da chamada',
  FST_ERR_CTP_INVALID_JSON_BODY: 'Não foi possível ler os dados enviados',
  FST_ERR_CTP_INVALID_MEDIA_TYPE: 'Formato de conteúdo não suportado nesta operação',
  FST_ERR_CTP_EMPTY_TYPE: 'Formato de conteúdo não suportado nesta operação',
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: 'O tamanho informado não corresponde aos dados enviados',
  FST_ERR_CTP_BODY_TOO_LARGE: 'Os dados enviados são grandes demais',
  FST_ERR_VALIDATION: 'Dados inválidos',
  FST_ERR_BAD_URL: 'Endereço inválido',

  FST_REQ_FILE_TOO_LARGE: fileTooLargeMessage,
  FST_FILES_LIMIT: 'Envie um arquivo por vez',
  FST_PARTS_LIMIT: 'Envie um arquivo por vez',
  FST_FIELDS_LIMIT: 'Envie um arquivo por vez',
  FST_INVALID_MULTIPART_CONTENT_TYPE: 'O arquivo precisa ser enviado como anexo de formulário',
  FST_INVALID_JSON_FIELD_ERROR: 'Um dos campos enviados não é um JSON válido',
  FST_MP_PREMATURE_CLOSE: 'O envio do arquivo foi interrompido antes de terminar',
  FST_PROTO_VIOLATION: 'Requisição inválida',
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Sem permissão para executar esta ação',
  404: 'Recurso não encontrado',
  405: 'Operação não permitida neste endereço',
  406: 'Formato de resposta não suportado',
  409: 'Conflito de dados',
  413: 'Os dados enviados são grandes demais',
  415: 'Formato de conteúdo não suportado nesta operação',
  422: 'Dados inválidos',
  429: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.',
}

/**
 * Mensagem em português para erros levantados pelo Fastify e seus plugins, que trazem o texto
 * original em inglês. Nunca devolve `undefined`: sem código conhecido, cai na mensagem do status.
 */
export function frameworkErrorMessage(code: string | undefined, statusCode: number): string {
  const mapped = code ? FRAMEWORK_MESSAGES[code] : undefined
  if (mapped) return typeof mapped === 'function' ? mapped() : mapped
  return STATUS_MESSAGES[statusCode] ?? 'Não foi possível concluir a operação'
}

export function formatRetryDelay(milliseconds: number): string {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000))
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`

  const minutes = Math.ceil(seconds / 60)
  return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
}
