import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { db, pool } from '../db/client.js'
import { comEscopoDePlataforma } from '../db/scope.js'
import { users } from '../db/schema/index.js'
import { passwordSchema } from '../shared/schemas/password.schema.js'
import { emailSchema } from '../shared/schemas/email.schema.js'

/**
 * Redefine a senha de um super admin. É o caminho de recuperação da conta de plataforma, que fica de
 * fora do "esqueci minha senha" por e-mail de propósito: ela alcança os dados de todos os clientes, e
 * amarrar isso a uma caixa de entrada seria trocar a segurança de todo mundo pela de um e-mail.
 *
 * Sem tela, igual ao `eraseCompany`. Quem roda precisa de acesso ao servidor, que é a barreira.
 *
 *   node dist/scripts/resetPlatformPassword.js --email=voce@exemplo.com --password='senha-nova-forte'
 *   node dist/scripts/resetPlatformPassword.js --list
 */

class UsageError extends Error {}

function readFlag(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

async function run() {
  const listar = process.argv.includes('--list')

  if (listar) {
    const contas = await db
      .select({ email: users.email, name: users.name, active: users.active })
      .from(users)
      .where(and(eq(users.role, 'super_admin'), isNull(users.deletedAt)))

    if (contas.length === 0) {
      console.log('Nenhuma conta de plataforma. Rode `npm run db:seed:platform` para criar a primeira.')
      return
    }

    console.log(`${contas.length} conta(s) de plataforma:`)
    for (const conta of contas) {
      console.log(`  ${conta.email}  (${conta.name})${conta.active ? '' : '  [desativada]'}`)
    }
    return
  }

  const emailBruto = readFlag('email')
  const senha = readFlag('password')

  if (!emailBruto || !senha) {
    throw new UsageError(
      'Informe --email=<e-mail da conta> e --password=<senha nova>. Use --list para ver as contas existentes.',
    )
  }

  // `safeParse` e não `parse`: o erro cru do Zod sai como despejo de JSON no terminal, e quem está
  // recuperando o acesso ao próprio sistema merece a mesma frase que a tela mostraria.
  const emailConferido = emailSchema.safeParse(emailBruto)
  if (!emailConferido.success) {
    throw new UsageError(emailConferido.error.issues[0].message)
  }

  // Mesma regra de senha das telas: o comando não pode ser a porta dos fundos para uma senha fraca.
  const senhaConferida = passwordSchema.safeParse(senha)
  if (!senhaConferida.success) {
    throw new UsageError(senhaConferida.error.issues[0].message)
  }

  const email = emailConferido.data
  const senhaValida = senhaConferida.data

  // O filtro por papel é o que separa ferramenta de recuperação de porta dos fundos: este comando não
  // alcança conta de empresa-cliente. Para essas, o super admin resolve pela tela de usuários.
  const [conta] = await db
    .select({ id: users.id, name: users.name, active: users.active })
    .from(users)
    .where(and(eq(users.email, email), eq(users.role, 'super_admin'), isNull(users.deletedAt)))

  if (!conta) {
    throw new UsageError(
      `Nenhuma conta de plataforma com o e-mail ${email}. Este comando só alcança super admin; use --list para conferir.`,
    )
  }

  const agora = new Date()
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(senhaValida, 10), passwordChangedAt: agora, updatedAt: agora })
    .where(eq(users.id, conta.id))

  console.log(`Senha de "${conta.name}" (${email}) redefinida.`)
  // `passwordChangedAt` recusa todo token emitido antes deste instante, então qualquer sessão aberta
  // com a senha antiga cai. É o efeito desejado quando o motivo da redefinição é suspeita de invasão.
  console.log('Todas as sessões abertas dessa conta foram encerradas.')
  if (!conta.active) {
    console.log('Atenção: a conta está desativada e continua sem conseguir entrar, mesmo com a senha nova.')
  }
}

// Travessia declarada: a conta de plataforma vive na empresa Plataforma e o comando roda sem sessão.
comEscopoDePlataforma(run)
  .catch((error) => {
    console.error(error instanceof UsageError ? error.message : `Falha ao redefinir a senha: ${error}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => {})
  })
