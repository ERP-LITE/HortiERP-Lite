import type { Pool } from 'pg'
import { env } from '../shared/config/env.js'

function credenciaisDaUrl(url: string) {
  const { username, password } = new URL(url)
  if (!username) throw new Error('APP_DATABASE_URL não traz usuário.')
  if (!password) throw new Error('APP_DATABASE_URL não traz senha.')
  return { papel: decodeURIComponent(username), senha: decodeURIComponent(password) }
}

// `CREATE ROLE` e `GRANT` não aceitam parâmetro de consulta. Em vez de escapar à mão, o próprio
// PostgreSQL monta o comando com `format`, que cita identificador (%I) e literal (%L) pelas regras
// dele — inclusive senha com aspas ou barra invertida.
async function comando(pool: Pool, molde: string, ...valores: string[]) {
  const marcadores = valores.map((_, indice) => `$${indice + 2}::text`).join(', ')
  const { rows } = await pool.query<{ sql: string }>(
    `SELECT format($1::text${marcadores ? `, ${marcadores}` : ''}) AS sql`,
    [molde, ...valores],
  )
  return rows[0].sql
}

export async function ensureAppRole(pool: Pool) {
  const { papel, senha } = credenciaisDaUrl(env.APP_DATABASE_URL)

  const { rows: contexto } = await pool.query<{ dono: string; banco: string }>(
    'SELECT current_user AS dono, current_database() AS banco',
  )
  const { dono, banco } = contexto[0]

  // Sem esta saída, um ambiente onde APP_DATABASE_URL caiu no fallback para DATABASE_URL faria o
  // script tirar o superusuário do próprio dono do banco. Aviso e não erro para o `db:migrate` local
  // seguir funcionando sem a variável; em produção o env.ts já recusa subir nessa situação.
  if (papel === dono) {
    console.warn(
      `APP_DATABASE_URL aponta para "${papel}", que é o dono do banco: papel de aplicação não criado.`,
    )
    return
  }

  const { rowCount } = await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [papel])

  if (!rowCount) {
    await pool.query(await comando(pool, 'CREATE ROLE %I WITH LOGIN PASSWORD %L', papel, senha))
    console.log(`Papel de aplicação "${papel}" criado.`)
  }

  // Reaplicado a cada deploy de propósito: o ambiente é a fonte da verdade da senha, e os atributos
  // negativos garantem que uma concessão manual feita no meio do caminho não sobreviva.
  await pool.query(
    await comando(
      pool,
      'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION',
      papel,
      senha,
    ),
  )

  await pool.query(await comando(pool, 'GRANT CONNECT ON DATABASE %I TO %I', banco, papel))
  await pool.query(await comando(pool, 'GRANT USAGE ON SCHEMA public TO %I', papel))
  await pool.query(
    await comando(pool, 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', papel),
  )
  await pool.query(await comando(pool, 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', papel))

  // Os GRANT acima só alcançam o que já existe. Sem isto, a tabela criada pela próxima migration
  // nasceria inacessível para a API.
  await pool.query(
    await comando(
      pool,
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
      dono,
      papel,
    ),
  )
  await pool.query(
    await comando(
      pool,
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
      dono,
      papel,
    ),
  )

  const { rows: conferencia } = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
    'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1',
    [papel],
  )

  if (conferencia[0].rolsuper || conferencia[0].rolbypassrls) {
    throw new Error(
      `Papel "${papel}" continua podendo ignorar RLS (rolsuper=${conferencia[0].rolsuper}, rolbypassrls=${conferencia[0].rolbypassrls}).`,
    )
  }

  console.log(`Papel de aplicação "${papel}": sem superusuário, sem bypass de RLS, permissões em dia.`)
}
