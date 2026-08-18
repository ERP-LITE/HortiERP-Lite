/**
 * Confere (ou atualiza com --write) o hash de script-src no Caddyfile contra o <script> inline de
 * apps/web/index.html. O acoplamento existe porque aquele script tem de ser inline para aplicar o
 * tema antes da primeira pintura; sem o hash, a CSP precisaria de 'unsafe-inline' e deixaria de
 * proteger contra script injetado. Divergência não derruba o sistema — só faz o tema piscar — então
 * um verificador explícito é o que evita descobrir isso pelo relato do usuário.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const htmlPath = join(raiz, 'apps/web/index.html')
// A CSP vive em dois lugares de propósito: o Caddy protege o tráfego público e o nginx protege quem
// alcançar a porta 8080 direto. Duplicação divergiria em silêncio, então as duas são conferidas aqui.
const alvos = [join(raiz, 'deploy/Caddyfile'), join(raiz, 'deploy/nginx.conf')]

const html = await readFile(htmlPath, 'utf8')
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])

if (inline.length !== 1) {
  console.error(`Esperava exatamente 1 script inline em apps/web/index.html, encontrei ${inline.length}.`)
  console.error('Cada script inline precisa do próprio hash em script-src. Ajuste este verificador junto.')
  process.exit(1)
}

const esperado = `sha256-${createHash('sha256').update(inline[0]).digest('base64')}`
const escrever = process.argv.includes('--write')
const problemas = []

for (const caminho of alvos) {
  const nome = caminho.split('/').pop()
  const conteudo = await readFile(caminho, 'utf8')
  const encontrados = [...conteudo.matchAll(/script-src 'self' '(sha256-[^']+)'/g)].map((m) => m[1])

  if (encontrados.length === 0) {
    problemas.push(`${nome}: não achei o padrão "script-src 'self' 'sha256-…'"`)
    continue
  }

  const divergentes = encontrados.filter((h) => h !== esperado)
  if (divergentes.length === 0) {
    console.log(`${nome}: em dia (${encontrados.length}x)`)
    continue
  }

  if (!escrever) {
    problemas.push(`${nome}: ${divergentes.join(', ')}`)
    continue
  }

  let atualizado = conteudo
  for (const h of new Set(divergentes)) atualizado = atualizado.replaceAll(h, esperado)
  await writeFile(caminho, atualizado, 'utf8')
  console.log(`${nome}: atualizado (${divergentes.length}x)`)
}

if (problemas.length > 0) {
  console.error(`\nHash da CSP desatualizado. Esperado: ${esperado}`)
  for (const p of problemas) console.error(`  ${p}`)
  console.error('\nRode: npm run csp:hash -- --write')
  process.exit(1)
}
