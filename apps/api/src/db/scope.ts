import { drizzle } from 'drizzle-orm/node-postgres'
import type { PoolClient } from 'pg'
import { db, escopoAtual, pool, type Escopo } from './client.js'
import * as schema from './schema/index.js'

function escopoDe(client: PoolClient): Escopo {
  return { client, db: drizzle(client, { schema }) }
}

async function definir(client: PoolClient, empresa: string | null, plataforma = false) {
  // As duas de uma vez, sempre: a conexão vem do pool e pode trazer marca de um uso anterior. Definir
  // só a empresa deixaria uma travessia aberta por herança — foi assim que um INSERT em outra empresa
  // passou na primeira versão deste arquivo.
  // `set_config` e não `SET`: aceita parâmetro, então o id não entra na string do comando.
  await client.query("SELECT set_config('app.empresa', $1, false), set_config('app.plataforma', $2, false)", [
    empresa ?? '',
    plataforma ? 'on' : 'off',
  ])
}

/**
 * Reserva uma conexão para a requisição e a devolve ao final. Sem empresa definida, as políticas não
 * devolvem linha nenhuma — quem precisa de dados chama `usarEmpresa` ou `comEscopoDePlataforma`.
 */
export async function abrirEscopoDaRequisicao() {
  const client = await pool.connect()
  await definir(client, null)
  return escopoDe(client)
}

export async function fecharEscopoDaRequisicao(escopo: Escopo) {
  try {
    await escopo.client.query('RESET ALL')
  } finally {
    escopo.client.release()
  }
}

/** Estreita o escopo atual para uma empresa. Chamado uma vez, no fim do `authenticate`. */
export async function usarEmpresa(companyId: string) {
  const escopo = escopoAtual.getStore()
  if (!escopo) throw new Error('usarEmpresa chamado fora de um escopo de requisição.')
  await definir(escopo.client, companyId)
}

/**
 * Roda um trecho podendo atravessar empresas. Existe para as travessias legítimas — login, validação
 * de sessão, cobranças da plataforma, retenção e manutenção. Cada uso é uma exceção declarada: se
 * aparecer num serviço comum de uma empresa, é bug.
 */
export async function comEscopoDePlataforma<T>(acao: () => Promise<T>): Promise<T> {
  const existente = escopoAtual.getStore()

  if (existente) {
    // `is_local = false` (nível de sessão) e não `true`: fora de uma transação, marca local morre no
    // fim do próprio statement. Por isso o `finally` precisa restaurar na mão — e restaurar o valor
    // anterior, não 'off': aninhar duas chamadas desligaria a de fora ao sair da de dentro.
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

  const client = await pool.connect()
  try {
    await definir(client, null, true)
    return await escopoAtual.run(escopoDe(client), acao)
  } finally {
    await client.query('RESET ALL').catch(() => {})
    client.release()
  }
}

/**
 * Roda um trecho no escopo de uma empresa, fora de requisição. As requisições já têm o seu, aberto no
 * hook; isto é para quem chama um serviço direto — testes hoje, tarefa de fundo amanhã.
 */
export async function comEscopoDaEmpresa<T>(companyId: string, acao: () => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await definir(client, companyId)
    return await escopoAtual.run(escopoDe(client), acao)
  } finally {
    await client.query('RESET ALL').catch(() => {})
    client.release()
  }
}

/**
 * Libera a travessia entre empresas para o **resto** da requisição. Usado como `preHandler` nos
 * módulos que administram a plataforma, ao lado do `requireRole('super_admin')` que os protege — a
 * travessia fica declarada no mesmo lugar da autorização. Não precisa desfazer: a conexão passa por
 * `RESET ALL` ao voltar para o pool.
 */
export async function permitirTravessiaDePlataforma() {
  const escopo = escopoAtual.getStore()
  if (!escopo) throw new Error('permitirTravessiaDePlataforma chamado fora de um escopo de requisição.')
  await escopo.client.query("SELECT set_config('app.plataforma', 'on', false)")
}

/**
 * Reserva uma conexão em escopo de plataforma e devolve o escopo, sem callback e sem entrar nele.
 * Existe para os testes, que leem o banco direto para montar fixture e conferir resultado.
 */
export async function reservarEscopoDePlataforma() {
  const client = await pool.connect()
  await definir(client, null, true)
  return escopoDe(client)
}

export async function liberarEscopoDePlataforma(escopo: Escopo) {
  try {
    await escopo.client.query('RESET ALL')
  } finally {
    escopo.client.release()
  }
}

export { db }
