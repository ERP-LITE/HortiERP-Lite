import { AsyncLocalStorage } from 'node:async_hooks'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool, type PoolClient } from 'pg'
import { env } from '../shared/config/env.js'
import * as schema from './schema/index.js'

export type Database = NodePgDatabase<typeof schema>

// Papel de aplicação, sem superusuário: é o que faz o RLS valer. O papel dono só aparece em
// migrate.ts. Ver docs/decisoes-arquiteturais.md.
export const pool = new Pool({
  connectionString: env.APP_DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
})

const poolDb = drizzle(pool, { schema })

export interface Escopo {
  db: Database
  client: PoolClient
}

export const escopoAtual = new AsyncLocalStorage<Escopo>()

// As políticas de RLS leem a empresa de uma variável de sessão, que mora na conexão. Este proxy faz
// `db` apontar para a conexão reservada do escopo atual quando existe uma, e para o pool quando não —
// caso em que nenhuma variável está definida e as políticas não devolvem linha nenhuma. É de
// propósito: quem esquecer de abrir escopo vê zero linhas, não os dados de outra empresa.
export const db = new Proxy(poolDb, {
  get(target, propriedade, receptor) {
    const alvo = escopoAtual.getStore()?.db ?? target
    const valor = Reflect.get(alvo, propriedade, alvo === target ? receptor : alvo)
    return typeof valor === 'function' ? valor.bind(alvo) : valor
  },
}) as Database
