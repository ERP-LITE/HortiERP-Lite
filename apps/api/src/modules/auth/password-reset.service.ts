import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { comEscopoDePlataforma } from '../../db/scope.js'
import { passwordResetTokens, users } from '../../db/schema/index.js'
import { env } from '../../shared/config/env.js'
import { AppError } from '../../shared/errors/AppError.js'
import { recordActivity } from '../../shared/db/recordActivity.js'
import { enviarEmail } from '../../shared/mail/mailer.js'
import { findUsableUserByEmail } from './auth.service.js'

type Log = { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void }

/** 32 bytes = 256 bits. O que viaja no link; no banco fica só o SHA-256 dele. */
function gerarToken() {
  return randomBytes(32).toString('base64url')
}

function hashDoToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linkDeRedefinicao(token: string) {
  return `${env.APP_PUBLIC_URL}/redefinir-senha?token=${encodeURIComponent(token)}`
}

function minutos(quantidade: number) {
  return quantidade * 60 * 1000
}

function mensagem(nome: string, link: string) {
  const validade = `${env.PASSWORD_RESET_TTL_MINUTES} minutos`
  const linkSeguro = escaparHtml(link)

  return {
    subject: 'Redefinição de senha do HortiERP',
    text: [
      `Olá, ${nome}.`,
      '',
      'Alguém pediu para redefinir a senha da sua conta no HortiERP. Para escolher uma senha nova, abra o endereço abaixo:',
      '',
      link,
      '',
      `O link vale por ${validade} e só pode ser usado uma vez.`,
      '',
      'Se não foi você que pediu, ignore esta mensagem. Sua senha atual continua valendo e nada muda.',
    ].join('\n'),
    html: [
      '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111827">',
      `<p>Olá, ${escaparHtml(nome)}.</p>`,
      '<p>Alguém pediu para redefinir a senha da sua conta no HortiERP. Para escolher uma senha nova, clique no botão:</p>',
      `<p><a href="${linkSeguro}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">Redefinir minha senha</a></p>`,
      `<p style="color:#6b7280;font-size:13px">Se o botão não funcionar, copie e cole este endereço no navegador:<br><span style="word-break:break-all">${linkSeguro}</span></p>`,
      `<p>O link vale por ${validade} e só pode ser usado uma vez.</p>`,
      '<p style="color:#6b7280;font-size:13px">Se não foi você que pediu, ignore esta mensagem. Sua senha atual continua valendo e nada muda.</p>',
      '</div>',
    ].join(''),
  }
}

/**
 * Pedido de redefinição. Não devolve nada e nunca falha por causa do e-mail informado: contar que
 * uma conta existe entrega ao atacante metade do trabalho, e é a mesma razão do `HASH_DE_DESCARTE`
 * no login. Quem chama responde igual dos dois jeitos.
 */
export async function requestPasswordReset(email: string, log?: Log) {
  const user = await findUsableUserByEmail(email)
  if (!user) return

  /**
   * Super admin fora do fluxo, e sai por aqui em silêncio: a resposta da rota é a mesma de sempre,
   * senão a própria recusa contaria quais e-mails são da plataforma.
   *
   * O motivo é o alcance da conta. Um super admin entra em qualquer empresa-cliente com permissão de
   * administrador, então redefinir a senha dele por e-mail faria a segurança dos dados de **todos**
   * os clientes valer o que valer uma caixa de entrada, sem segundo fator para segurar. As contas de
   * empresa-cliente não têm esse alcance, e para elas a troca compensa.
   *
   * A recuperação continua existindo por dois caminhos que não passam por e-mail: outro super admin
   * pela tela de plataforma, e `npm run platform:reset-password` no servidor. Mesmo princípio do
   * `data:erase-company`, que também não tem botão de propósito.
   */
  if (user.role === 'super_admin') {
    log?.info({ email }, 'Pedido de redefinição ignorado: conta de plataforma não usa o fluxo por e-mail')
    return
  }

  const agora = new Date()

  // Travessia declarada: não existe sessão, logo não existe empresa na conexão. Devolve `null`
  // quando o pedido cai na carência, e aí nenhum e-mail sai.
  const token = await comEscopoDePlataforma(async () => {
    const [recente] = await db
      .select({ createdAt: passwordResetTokens.createdAt })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, agora),
        ),
      )
      .orderBy(desc(passwordResetTokens.createdAt))
      .limit(1)

    if (recente && agora.getTime() - recente.createdAt.getTime() < minutos(env.PASSWORD_RESET_COOLDOWN_MINUTES)) {
      return null
    }

    const novo = gerarToken()
    await db.insert(passwordResetTokens).values({
      companyId: user.companyId,
      userId: user.id,
      tokenHash: hashDoToken(novo),
      expiresAt: new Date(agora.getTime() + minutos(env.PASSWORD_RESET_TTL_MINUTES)),
    })

    return novo
  })

  if (!token) return

  try {
    await enviarEmail({ to: user.email, ...mensagem(user.name, linkDeRedefinicao(token)) }, log)
  } catch (erro) {
    // O erro fica no log do servidor. Devolver falha aqui contaria a quem chamou que o e-mail
    // existe, que é justamente o que o resto desta função evita.
    log?.error({ erro: (erro as Error).message }, 'Falha ao enviar e-mail de redefinição de senha')
  }
}

const TOKEN_INVALIDO = 'Link inválido ou expirado. Peça uma nova redefinição de senha.'

/**
 * Consome o token e grava a senha nova. `passwordChangedAt` derruba de graça toda sessão aberta com
 * a senha antiga, que é a proteção que já existe na troca de senha pela tela de perfil.
 */
export async function resetPassword(token: string, newPassword: string) {
  const agora = new Date()
  const passwordHash = await bcrypt.hash(newPassword, 10)

  // Travessia declarada: o token é a credencial e vale sozinho; não há sessão nem empresa ainda.
  await comEscopoDePlataforma(() =>
    db.transaction(async (tx) => {
      const [pedido] = await tx
        .select({
          userId: passwordResetTokens.userId,
          expiresAt: passwordResetTokens.expiresAt,
          usedAt: passwordResetTokens.usedAt,
        })
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, hashDoToken(token)))
        .limit(1)
        // Trava a linha: dois cliques no mesmo link ao mesmo tempo passariam os dois pela checagem
        // antes de qualquer um marcar o uso, e "uso único" deixaria de ser verdade.
        .for('update')

      // Uma frase só para os três casos: dizer qual deles aconteceu ensina a diferença entre token
      // inexistente, gasto e vencido, e nenhuma dessas informações ajuda quem é dono da conta.
      if (!pedido || pedido.usedAt || pedido.expiresAt <= agora) {
        throw new AppError(TOKEN_INVALIDO, 400, 'INVALID_RESET_TOKEN')
      }

      const [alvo] = await tx
        .update(users)
        .set({ passwordHash, passwordChangedAt: agora, updatedAt: agora })
        .where(
          and(
            eq(users.id, pedido.userId),
            eq(users.active, true),
            isNull(users.deletedAt),
            // Repete aqui a recusa do pedido: token de super admin emitido antes dessa regra existir
            // continuaria válido até vencer, e é justamente o link que não pode funcionar.
            ne(users.role, 'super_admin'),
          ),
        )
        .returning({ id: users.id, name: users.name, companyId: users.companyId })

      // Conta desativada ou excluída entre o pedido e o clique: o link não pode reabrir a porta.
      if (!alvo) throw new AppError(TOKEN_INVALIDO, 400, 'INVALID_RESET_TOKEN')

      // Todos, não só o usado: quem pediu duas vezes não pode ficar com um link vivo sobrando.
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: agora })
        .where(and(eq(passwordResetTokens.userId, pedido.userId), isNull(passwordResetTokens.usedAt)))

      // Sem isto a troca de senha some do rastro: o log técnico registra o caminho e o IP, mas a
      // requisição não tem sessão, então não sabe de quem era a conta. É o único lugar onde a
      // redefinição fica ligada a um nome.
      await recordActivity(
        {
          companyId: alvo.companyId,
          actorId: alvo.id,
          action: 'alterou',
          entity: 'usuario',
          entityId: alvo.id,
          entityLabel: alvo.name,
          details: { campo: 'senha', origem: 'link de redefinição por e-mail' },
        },
        tx,
      )
    }),
  )
}
