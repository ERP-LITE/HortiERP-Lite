import 'dotenv/config'
import { z } from 'zod'

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3333),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatório'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    // Aceita uma ou várias origens separadas por vírgula. Útil no desenvolvimento para
    // atender ao mesmo tempo o desktop (localhost) e o celular (IP da máquina na rede).
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

    if (value.CORS_ORIGIN.some((origin) => !origin.startsWith('https://'))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN deve usar HTTPS em produção',
      })
    }
  })

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors)
  throw new Error('Falha ao carregar variáveis de ambiente')
}

export const env = parsed.data
