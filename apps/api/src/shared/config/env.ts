import 'dotenv/config'
import { z } from 'zod'

function usuarioDaUrl(url: string) {
  try {
    return new URL(url).username
  } catch {
    return null
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3333),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
    APP_DATABASE_URL: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined),
    // Cada requisição reserva uma conexão do início ao fim: o pool dimensiona requisições
    // simultâneas, não consultas.
    DATABASE_POOL_MAX: z.coerce.number().int().min(2).default(20),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatório'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    CORS_ORIGIN: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(z.string().url('CORS_ORIGIN deve conter apenas URLs válidas'))
          .min(1, 'CORS_ORIGIN deve ter ao menos uma origem'),
      ),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    INVOICE_STORAGE_PATH: z.string().min(1).default('./storage/invoices'),
    INVOICE_MAX_FILE_SIZE: z.coerce.number().int().positive().default(10 * 1024 * 1024),
    TECHNICAL_LOG_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(180, 'TECHNICAL_LOG_RETENTION_DAYS não pode ser menor que 180 dias (Marco Civil, art. 15)')
      .default(180),
    AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).default(5 * 365),
    RETENTION_HEARTBEAT_URL: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined)
      .pipe(z.string().url('RETENTION_HEARTBEAT_URL deve ser uma URL válida').optional()),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== 'production') return

    if (
      value.JWT_SECRET.length < 32 ||
      value.JWT_SECRET === 'change-me-in-production' ||
      value.JWT_SECRET.startsWith('troque-')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET deve ter ao menos 32 caracteres e não pode usar o valor de exemplo em produção',
      })
    }

    if (!value.APP_DATABASE_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_DATABASE_URL'],
        message:
          'APP_DATABASE_URL é obrigatório em produção: a API não deve se conectar com o papel dono do banco',
      })
    } else if (usuarioDaUrl(value.APP_DATABASE_URL) === usuarioDaUrl(value.DATABASE_URL)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_DATABASE_URL'],
        message:
          'APP_DATABASE_URL usa o mesmo usuário de DATABASE_URL; nesse caso a API segue com o papel dono e o RLS não vale nada',
      })
    }

    if (value.CORS_ORIGIN.some((origin) => !origin.startsWith('https://'))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN deve usar HTTPS em produção',
      })
    }
  })

const parsedSchema = envSchema.transform((value) => ({
  ...value,
  APP_DATABASE_URL: value.APP_DATABASE_URL ?? value.DATABASE_URL,
}))

const parsed = parsedSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors)
  throw new Error('Falha ao carregar variáveis de ambiente')
}

export const env = parsed.data

if (env.NODE_ENV !== 'production' && !process.env.APP_DATABASE_URL) {
  console.warn(
    'APP_DATABASE_URL não definida: usando DATABASE_URL. Em produção isso é recusado — veja apps/api/.env.example.',
  )
}
