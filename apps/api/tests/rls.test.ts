import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { Pool } from 'pg'
import { env } from '../src/shared/config/env.js'
import { assertTestDatabase } from './helpers.js'

// Etapa 1 do RLS: ainda não há política nenhuma nas tabelas do sistema. O que este arquivo prova é
// que o papel da API está sujeito a RLS — sem isso, escrever política na etapa 2 não protegeria nada.
const TABELA = 'rls_prova_etapa1'
const PAPEL = decodeURIComponent(new URL(env.APP_DATABASE_URL).username)

describe('papel de aplicação diante do RLS', () => {
  const dono = new Pool({ connectionString: process.env.DATABASE_URL })
  const aplicacao = new Pool({ connectionString: env.APP_DATABASE_URL })

  before(async () => {
    assertTestDatabase()
    await dono.query(`DROP TABLE IF EXISTS ${TABELA}`)
    await dono.query(`CREATE TABLE ${TABELA} (id integer PRIMARY KEY)`)
    await dono.query(`INSERT INTO ${TABELA} (id) VALUES (1)`)
  })

  after(async () => {
    await dono.query(`DROP TABLE IF EXISTS ${TABELA}`)
    await dono.end()
    await aplicacao.end()
  })

  it('não tem superusuário nem bypass de RLS', async () => {
    const { rows } = await dono.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean }>(
      'SELECT rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname = $1',
      [PAPEL],
    )

    assert.equal(rows.length, 1, `o papel ${PAPEL} não existe no banco`)
    assert.equal(rows[0].rolsuper, false)
    assert.equal(rows[0].rolbypassrls, false)
    assert.equal(rows[0].rolcreaterole, false)
  })

  it('alcança tabela criada depois dele, sem GRANT manual', async () => {
    // Prova o ALTER DEFAULT PRIVILEGES: sem ele, a tabela da próxima migration nasceria invisível
    // para a API e o erro só apareceria em produção.
    const { rows } = await aplicacao.query(`SELECT id FROM ${TABELA}`)
    assert.deepEqual(rows, [{ id: 1 }])
  })

  it('deixa de ver a linha quando a política nega, e o dono continua vendo', async () => {
    await dono.query(`ALTER TABLE ${TABELA} ENABLE ROW LEVEL SECURITY`)
    await dono.query(`CREATE POLICY nega_tudo ON ${TABELA} USING (false)`)

    const daAplicacao = await aplicacao.query(`SELECT id FROM ${TABELA}`)
    assert.equal(daAplicacao.rowCount, 0, 'a política não foi aplicada ao papel da API')

    // O dono é superusuário, e superusuário ignora RLS inteiramente — nem FORCE ROW LEVEL SECURITY
    // muda isso. É a razão de a API precisar de um papel próprio.
    await dono.query(`ALTER TABLE ${TABELA} FORCE ROW LEVEL SECURITY`)
    const doDono = await dono.query(`SELECT id FROM ${TABELA}`)
    assert.equal(doDono.rowCount, 1, 'o dono deixou de ver a linha; a premissa da etapa 1 mudou')
  })

  it('não cria tabela e não trunca', async () => {
    await assert.rejects(() => aplicacao.query('CREATE TABLE nao_deveria_existir (id integer)'), /permission denied/)
    await assert.rejects(() => aplicacao.query(`TRUNCATE TABLE ${TABELA}`), /permission denied/)
  })
})
