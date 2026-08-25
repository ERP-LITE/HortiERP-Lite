import { drizzle } from 'drizzle-orm/node-postgres'
import type { PoolClient } from 'pg'
import { escopoAtual, pool, type Escopo } from './client.js'
import * as schema from './schema/index.js'

function escopoDe(client: PoolClient): Escopo {
  return { client, db: drizzle(client, { schema }) }
}

async function definir(client: PoolClient, empresa: string | null, plataforma = false) {
  // As duas de uma vez, sempre: a conexão vem do pool e pode trazer travessia ligada de um uso
  // anterior. Definir só a empresa já deixou um INSERT em outra empresa passar.
  await client.query("SELECT set_config('app.empresa', $1, false), set_config('app.plataforma', $2, false)", [
    empresa ?? '',
    plataforma ? 'on' : 'off',
  ])
}

export async function reservarEscopo(empresa: string | null, plataforma = false) {
  const client = await pool.connect()
  try {
    await definir(client, empresa, plataforma)
  } catch (erro) {
    client.release()
    throw erro
  }
  return escopoDe(client)
}

export async function devolverEscopo(escopo: Escopo) {
  try {
    await escopo.client.query('RESET ALL')
  } catch {
    // Conexão já perdida: não há o que resetar, e segurá-la seria pior.
  } finally {
    escopo.client.release()
  }
}

async function comEscopo<T>(empresa: string | null, plataforma: boolean, acao: () => Promise<T>): Promise<T> {
  const escopo = await reservarEscopo(empresa, plataforma)
  try {
    return await escopoAtual.run(escopo, acao)
  } finally {
    await devolverEscopo(escopo)
  }
}

export async function usarEmpresa(companyId: string) {
  const escopo = escopoAtual.getStore()
  if (!escopo) throw new Error('usarEmpresa chamado fora de um escopo de requisição.')
  await definir(escopo.client, companyId)
}

// Cada uso é uma travessia declarada. Se aparecer num serviço comum de uma empresa, é bug.
export async function comEscopoDePlataforma<T>(acao: () => Promise<T>): Promise<T> {
  const existente = escopoAtual.getStore()
  if (!existente) return comEscopo(null, true, acao)

  // Restaura o valor anterior e não 'off': aninhar duas chamadas desligaria a de fora ao sair da de
  // dentro. E `is_local = false` porque fora de transação marca local morre no fim do statement.
  const { rows } = await existente.client.query<{ anterior: string | null }>(
    "SELECT current_setting('app.plataforma', true) AS anterior",
  )
  const anterior = rows[0]?.anterior ?? ''
  await existente.client.query("SELECT set_config('app.plataforma', 'on', false)")
  try {
    return await acao()
  } finally {
    await existente.client.query("SELECT set_config('app.plataforma', $1, false)", [anterior])
  }
}

export function comEscopoDaEmpresa<T>(companyId: string, acao: () => Promise<T>): Promise<T> {
  return comEscopo(companyId, false, acao)
}

// Vale pelo resto da requisição. Não precisa desfazer: a conexão leva `RESET ALL` ao voltar ao pool.
export async function permitirTravessiaDePlataforma() {
  const escopo = escopoAtual.getStore()
  if (!escopo) throw new Error('permitirTravessiaDePlataforma chamado fora de um escopo de requisição.')
  await escopo.client.query("SELECT set_config('app.plataforma', 'on', false)")
}
