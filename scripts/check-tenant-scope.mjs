/**
 * Procura consulta a tabela multiempresa que não menciona `companyId` na função onde roda.
 *
 * Por que existe: o isolamento entre empresas é escrito à mão em toda consulta
 * (`eq(tabela.companyId, companyId)`) e o banco não tem RLS — se uma consulta nova esquecer o
 * filtro, o PostgreSQL devolve os dados de todos os clientes sem reclamar. Ver
 * docs/decisoes-arquiteturais.md#isolamento-entre-empresas-não-tem-rede-de-proteção-no-banco.
 *
 * O que ele NÃO é: prova de isolamento. Ele pega o esquecimento honesto — a função que nunca
 * pensou em empresa — e não pega o filtro com a variável errada. Vale pelo custo, não pela força.
 *
 * A regra: **a função que contém a consulta precisa mencionar `companyId`**. Ela vem da convenção
 * documentada em docs/decisoes-arquiteturais.md — `companyId` é o primeiro argumento de toda função
 * de serviço. Duas alternativas foram descartadas por medir a coisa errada:
 *
 * - Olhar só o argumento do `.where()`: quase toda listagem monta a condição antes
 *   (`const where = and(...conditions)`, ou um helper como `buildLossesConditions`), então o
 *   verificador acusaria praticamente todas as consultas legítimas.
 * - Exigir o texto `<tabela>.companyId` na função: falha em quem delega a montagem da condição a um
 *   helper de outro arquivo, que é o caso de listLosses e dos relatórios.
 *
 * Limite conhecido: função que recebe `companyId` e esquece de usá-lo no `where` passa. Este
 * verificador pega a função que nunca pensou em empresa, não o filtro escrito errado.
 */
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import ts from 'typescript'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const apiSrc = join(raiz, 'apps/api/src')

/**
 * Supressões em vigor: consultas que atravessam empresas de propósito **e** que o verificador
 * acusaria. Cada linha precisa de motivo — exceção sem justificativa é como não ter verificador.
 *
 * A lista não é o inventário das travessias legítimas do sistema: várias delas mencionam
 * `companyId` por outro motivo (no `select`, ou porque fixam a empresa Plataforma) e passam sozinhas.
 * Esse inventário fica na documentação, não aqui — aqui só entra o que precisa ser silenciado.
 */
const TRAVESSIAS_LEGITIMAS = [
  {
    arquivo: 'modules/billings/billings.service.ts',
    tabela: 'companyBillings',
    motivo: 'cobrança é registro da plataforma sobre a empresa-cliente, não dado dentro dela; rotas exigem super_admin fora de impersonação',
  },
  {
    arquivo: 'modules/auth/auth.service.ts',
    tabela: 'users',
    motivo: 'login procura por e-mail, que é único globalmente — não existe sessão nem empresa ainda quando esta consulta roda',
  },
  {
    arquivo: 'scripts/cleanupInvoiceOrphans.ts',
    tabela: 'stockEntryAttachments',
    motivo: 'manutenção operacional: varre o disco de todas as empresas comparando com o banco, por definição transversal',
  },
]

const IGNORAR_PASTAS = new Set(['migrations', 'schema'])
const IGNORAR_ARQUIVOS = new Set(['seed.ts', 'seedPlatform.ts', 'client.ts', 'migrate.ts'])

async function arquivosTs(dir) {
  const encontrados = []
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (IGNORAR_PASTAS.has(item.name)) continue
      encontrados.push(...(await arquivosTs(join(dir, item.name))))
    } else if (item.name.endsWith('.ts') && !IGNORAR_ARQUIVOS.has(item.name)) {
      encontrados.push(join(dir, item.name))
    }
  }
  return encontrados
}

function parse(caminho, texto) {
  return ts.createSourceFile(caminho, texto, ts.ScriptTarget.Latest, true)
}

/** Tabelas que declaram `companyId` — a lista sai do schema, então tabela nova entra sozinha. */
async function tabelasMultiempresa() {
  const dir = join(apiSrc, 'db/schema')
  const tabelas = new Set()

  for (const nome of await readdir(dir)) {
    if (!nome.endsWith('.ts')) continue
    const fonte = parse(nome, await readFile(join(dir, nome), 'utf8'))

    for (const stmt of fonte.statements) {
      if (!ts.isVariableStatement(stmt)) continue
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
        if (/\bcompanyId:\s*uuid\('company_id'\)/.test(decl.initializer.getText(fonte))) {
          tabelas.add(decl.name.text)
        }
      }
    }
  }

  return tabelas
}

/** Função (ou arrow) que contém o nó — é nela que se procura a menção a companyId. */
function funcaoQueContem(node) {
  let atual = node.parent
  while (atual) {
    if (
      ts.isFunctionDeclaration(atual) ||
      ts.isMethodDeclaration(atual) ||
      ts.isArrowFunction(atual) ||
      ts.isFunctionExpression(atual)
    ) {
      return atual
    }
    atual = atual.parent
  }
  return undefined
}

/** Alvo da consulta, quando ele é uma tabela conhecida. Devolve undefined para tudo o mais. */
function tabelaAlvo(node, tabelas, fonte) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return undefined
  const metodo = node.expression.name.text

  // .from(tabela) / .insert(tabela) / .update(tabela) / .delete(tabela)
  if (['from', 'insert', 'update', 'delete'].includes(metodo)) {
    const arg = node.arguments[0]
    if (arg && ts.isIdentifier(arg) && tabelas.has(arg.text)) return arg.text
    return undefined
  }

  // db.query.<tabela>.findMany(...) / .findFirst(...)
  if (['findMany', 'findFirst'].includes(metodo)) {
    const alvo = node.expression.expression
    if (ts.isPropertyAccessExpression(alvo) && tabelas.has(alvo.name.text)) {
      const meio = alvo.expression
      if (ts.isPropertyAccessExpression(meio) && meio.name.text === 'query') return alvo.name.text
    }
    return undefined
  }

  return undefined
}

const tabelas = await tabelasMultiempresa()
const arquivos = await arquivosTs(apiSrc)
const violacoes = []
const excecoesUsadas = new Set()
let consultasVerificadas = 0

for (const caminho of arquivos) {
  const rel = relative(apiSrc, caminho)
  const texto = await readFile(caminho, 'utf8')
  const fonte = parse(caminho, texto)

  const visitar = (node) => {
    const tabela = tabelaAlvo(node, tabelas, fonte)
    if (tabela) {
      consultasVerificadas += 1
      const escopo = funcaoQueContem(node)
      const corpo = (escopo ?? fonte).getText(fonte)
      // `\bcompanyId\b` cobre o parâmetro, o filtro direto e o repasse a um helper.
      const pensouNaEmpresa = /\bcompanyId\b/.test(corpo)

      if (!pensouNaEmpresa) {
        const excecao = TRAVESSIAS_LEGITIMAS.find((e) => e.arquivo === rel && e.tabela === tabela)
        if (excecao) {
          excecoesUsadas.add(`${excecao.arquivo}::${excecao.tabela}`)
        } else {
          const { line } = fonte.getLineAndCharacterOfPosition(node.getStart(fonte))
          violacoes.push({ arquivo: rel, linha: line + 1, tabela, trecho: node.getText(fonte).split('\n')[0].trim().slice(0, 90) })
        }
      }
    }
    ts.forEachChild(node, visitar)
  }

  ts.forEachChild(fonte, visitar)
}

console.log(`Tabelas multiempresa no schema: ${[...tabelas].sort().join(', ')}`)
console.log(`Consultas analisadas: ${consultasVerificadas}`)

const obsoletas = TRAVESSIAS_LEGITIMAS.filter((e) => !excecoesUsadas.has(`${e.arquivo}::${e.tabela}`))
if (obsoletas.length > 0) {
  console.error('\nExceções que não casam com nenhuma consulta (o código mudou; remova-as):')
  for (const e of obsoletas) console.error(`  ${e.arquivo} → ${e.tabela}`)
}

if (violacoes.length > 0) {
  console.error(`\n${violacoes.length} consulta(s) a tabela multiempresa sem filtro de empresa na função:`)
  for (const v of violacoes) {
    console.error(`\n  ${v.arquivo}:${v.linha}  (${v.tabela})`)
    console.error(`    ${v.trecho}`)
    console.error(`    Falta \`eq(${v.tabela}.companyId, companyId)\` no where — ou uma linha em`)
    console.error('    TRAVESSIAS_LEGITIMAS de scripts/check-tenant-scope.mjs explicando por que atravessa empresas.')
  }
}

if (violacoes.length > 0 || obsoletas.length > 0) process.exit(1)
console.log(`Exceções declaradas e em uso: ${excecoesUsadas.size}`)
console.log('Nenhuma consulta sem escopo de empresa.')
