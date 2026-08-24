/**
 * Confere (ou atualiza com --write) a data do aviso de privacidade contra o texto dele.
 * Por que a data não é calculada nem derivada do build: docs/decisoes-arquiteturais.md.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const caminho = join(raiz, 'apps/web/src/modules/privacidade/PrivacyView.vue')

const LINHA_DATA = /^const atualizadoEm = '(.+)'$/m
const LINHA_RESUMO = /^const conteudoRevisado = '(sha256-[^']+)'$/m
const TEMPLATE = /<template>([\s\S]*)<\/template>/

const conteudo = await readFile(caminho, 'utf8')

const dataAtual = conteudo.match(LINHA_DATA)?.[1]
if (!dataAtual) {
  console.error(`Não achei a linha "const atualizadoEm = '...'" em ${caminho}.`)
  process.exit(1)
}

// Só o `<template>`: mexer em comentário ou no `<script>` não é revisão do aviso.
function resumoDoTexto(texto) {
  const template = texto.match(TEMPLATE)?.[1]
  if (template === undefined) {
    console.error(`Não achei o bloco <template> em ${caminho}.`)
    process.exit(1)
  }
  return `sha256-${createHash('sha256').update(template).digest('base64')}`
}

const esperado = resumoDoTexto(conteudo)
const registrado = conteudo.match(LINHA_RESUMO)?.[1]

if (registrado === esperado) {
  console.log(`Aviso de privacidade: em dia (atualizado em ${dataAtual}).`)
  process.exit(0)
}

if (!process.argv.includes('--write')) {
  console.error('O texto do aviso de privacidade mudou, mas a data continua a mesma.')
  console.error(`  data registrada: ${dataAtual}`)
  console.error(registrado ? `  resumo registrado: ${registrado}` : '  resumo registrado: (ausente)')
  console.error(`  resumo do texto atual: ${esperado}`)
  console.error('')
  console.error('A data é o que diz ao leitor se as regras mudaram desde a última leitura, então ela')
  console.error('precisa acompanhar o texto. Para atualizar as duas de uma vez:')
  console.error('  npm run privacy:date -- --write')
  process.exit(1)
}

const hoje = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
}).format(new Date())

let atualizado = conteudo.replace(LINHA_DATA, `const atualizadoEm = '${hoje}'`)
atualizado = LINHA_RESUMO.test(atualizado)
  ? atualizado.replace(LINHA_RESUMO, `const conteudoRevisado = '${esperado}'`)
  : atualizado.replace(
      /^const atualizadoEm = '.+'$/m,
      (linha) => `${linha}\nconst conteudoRevisado = '${esperado}'`,
    )

await writeFile(caminho, atualizado)
console.log(`Aviso de privacidade atualizado para ${hoje}.`)
