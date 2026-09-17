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
    // Endereço de quem pode falar pela API, não contagem de saltos nem booleano. Aceita IP, faixa
    // CIDR, lista separada por vírgula ou o apelido `uniquelocal`, que cobre as faixas privadas
    // onde os containers do Compose vivem. Os dois valores recusados abaixo erram para lados
    // opostos e nenhum dos dois reclama sozinho.
    TRUST_PROXY: z
      .string()
      .trim()
      .default('false')
      .transform((value, ctx) => {
        if (value === 'false') return false

        if (value === 'true') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'TRUST_PROXY `true` confiaria em qualquer X-Forwarded-For: o `request.ip` viraria o que quem chama escrever, o limite de tentativas por IP viraria enfeite e o IP do log seria inventado. Informe o endereço ou a faixa do proxy (`uniquelocal` cobre as faixas privadas do Docker).',
          })
          return z.NEVER
        }

        if (/^\d+$/.test(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'TRUST_PROXY por contagem de saltos não vale mais: desde o Fastify 5.12 ela recusa todos os peers (correção do GHSA-3m5p-2c4r-xxw2) e passa a valer o mesmo que `false`, sem avisar. Informe o endereço ou a faixa do proxy (`uniquelocal` cobre as faixas privadas do Docker).',
          })
          return z.NEVER
        }

        // A sintaxe em si quem confere é o proxy-addr, quando o Fastify monta a instância: errado
        // ali, a API não sobe. O que não pode é passar batido, que é o caso dos dois acima.
        return value
      }),
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
    ERROR_ALERT_HEARTBEAT_URL: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined)
      .pipe(z.string().url('ERROR_ALERT_HEARTBEAT_URL deve ser uma URL válida').optional()),
    // A janela consultada é este intervalo mais uma folga, para nenhum erro cair entre duas rodadas.
    ERROR_ALERT_INTERVAL_SECONDS: z.coerce.number().int().min(60).default(900),
    // 1 = todo erro de servidor merece um olhar. Num sistema saudável esse número fica em zero.
    ERROR_ALERT_THRESHOLD: z.coerce.number().int().min(1).default(1),
    RESEND_API_KEY: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined),
    // Precisa ser de um domínio verificado na Resend. O endereço de exemplo `onboarding@resend.dev`
    // só entrega para o dono da conta, então serve para desenvolvimento e não para cliente.
    MAIL_FROM: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined),
    // Base do link que vai no e-mail. Sem valor próprio cai na primeira origem do CORS, que em
    // produção é exatamente o endereço público do sistema.
    APP_PUBLIC_URL: z
      .string()
      .trim()
      .optional()
      .transform((value) => value?.replace(/\/+$/, '') || undefined)
      .pipe(z.string().url('APP_PUBLIC_URL deve ser uma URL válida').optional()),
    // Curto de propósito: o link é credencial de troca de senha viajando por e-mail, e caixa de
    // entrada invadida é justamente o cenário que o prazo limita.
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
    // Janela em que um novo pedido para a mesma conta não dispara outro e-mail. Sem ela, qualquer
    // pessoa entope a caixa de entrada de um usuário repetindo o formulário.
    PASSWORD_RESET_COOLDOWN_MINUTES: z.coerce.number().int().min(1).max(60).default(2),
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

    if (value.TRUST_PROXY === false) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRUST_PROXY'],
        message:
          'TRUST_PROXY deve ser o endereço ou a faixa do proxy na frente da API (`uniquelocal` com o gateway padrão). Com false, todo cliente chega como o IP do gateway e o limite de tentativas passa a ser compartilhado por todos.',
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

/**
 * Fora de produção o log faz as vezes da caixa de entrada, e é assim que se testa a redefinição sem
 * conta na Resend. Em produção não há log para a pessoa ler, então o pedido é recusado.
 */
export function recuperacaoPorEmailDisponivel(opcoes: {
  nodeEnv: string
  resendApiKey?: string
  mailFrom?: string
}) {
  if (opcoes.nodeEnv !== 'production') return true
  return Boolean(opcoes.resendApiKey && opcoes.mailFrom)
}

const parsedSchema = envSchema.transform((value) => ({
  ...value,
  APP_DATABASE_URL: value.APP_DATABASE_URL ?? value.DATABASE_URL,
  APP_PUBLIC_URL: value.APP_PUBLIC_URL ?? value.CORS_ORIGIN[0],
  RECUPERACAO_POR_EMAIL_DISPONIVEL: recuperacaoPorEmailDisponivel({
    nodeEnv: value.NODE_ENV,
    resendApiKey: value.RESEND_API_KEY,
    mailFrom: value.MAIL_FROM,
  }),
}))

const parsed = parsedSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors)
  throw new Error('Falha ao carregar variáveis de ambiente')
}

export const env = parsed.data

// Gritado no boot porque nada quebra até alguém precisar recuperar a senha, e aí é tarde.
if (env.NODE_ENV === 'production' && !env.RECUPERACAO_POR_EMAIL_DISPONIVEL) {
  console.warn(
    '[ATENÇÃO] RESEND_API_KEY e/ou MAIL_FROM não definidas: "Esqueci minha senha" responderá que está indisponível. ' +
      'O restante do sistema funciona normalmente. Para ligar, veja docs/deploy-producao.md.',
  )
}

if (env.NODE_ENV !== 'production' && !process.env.APP_DATABASE_URL) {
  console.warn(
    'APP_DATABASE_URL não definida: usando DATABASE_URL. Em produção isso é recusado — veja apps/api/.env.example.',
  )
}
