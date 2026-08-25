import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, pool } from './client.js'
import { companies, users } from './schema/index.js'
import { comEscopoDePlataforma } from './scope.js'

const PLATFORM_COMPANY_NAME = 'Plataforma'

async function run() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.PLATFORM_ADMIN_PASSWORD
  const name = process.env.PLATFORM_ADMIN_NAME || 'Super Admin'

  if (!email || !password) {
    throw new Error('Defina PLATFORM_ADMIN_EMAIL e PLATFORM_ADMIN_PASSWORD antes de rodar este script.')
  }

  const [existing] = await db.select().from(companies).where(eq(companies.name, PLATFORM_COMPANY_NAME))

  if (existing) {
    console.log('Empresa da plataforma já existe, nada a fazer.')
    return
  }

  await db.transaction(async (tx) => {
    const [company] = await tx.insert(companies).values({ name: PLATFORM_COMPANY_NAME }).returning()

    const passwordHash = await bcrypt.hash(password, 10)

    await tx.insert(users).values({
      companyId: company.id,
      name,
      email,
      passwordHash,
      role: 'super_admin',
    })
  })

  console.log('Empresa da plataforma e super admin criados com sucesso.')
  console.log(`Login: ${email}`)

}

// Escopo de plataforma: o seed cria a empresa, então não existe empresa de sessão ainda.
comEscopoDePlataforma(run)
  .catch((error) => {
    console.error('Falha ao rodar seed da plataforma:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => {})
  })
