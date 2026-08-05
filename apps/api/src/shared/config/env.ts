import 'dotenv/config'
import { z } from 'zod'

const turnstileTestSecretKeys = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
])

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3333),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatório'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    CORS_ORIGIN: z.string().url('CORS_ORIGIN deve ser uma URL válida').default('http://localhost:5173'),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    // O valor padrão é a chave secreta de teste da Cloudflare que "sempre passa",
    // permitindo o desenvolvimento local sem configuração adicional. Abaixo, o uso
    // de uma chave de teste é rejeitado explicitamente em produção.
    TURNSTILE_SECRET_KEY: z.string().default('1x0000000000000000000000000000000AA'),
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

    if (turnstileTestSecretKeys.has(value.TURNSTILE_SECRET_KEY) || value.TURNSTILE_SECRET_KEY.startsWith('troque-')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TURNSTILE_SECRET_KEY'],
        message: 'A chave de teste do Turnstile não pode ser usada em produção',
      })
    }

    if (!value.CORS_ORIGIN.startsWith('https://')) {
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
