import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import { CAMINHOS_PUBLICOS, emCaminhoPublico } from '../src/lib/publicRoutes'

const rotas = readFileSync(fileURLToPath(new URL('../src/router/index.ts', import.meta.url)), 'utf8')

/**
 * Lê os caminhos marcados com `meta: { public: true }` direto do roteador. O bloco de cada rota vai
 * de um `path:` até o próximo, então a marca é procurada dentro do trecho que pertence àquele path.
 */
function caminhosPublicosDoRoteador() {
  const blocos = rotas.split(/\n\s*\{\s*\n/)
  const encontrados: string[] = []

  for (const bloco of blocos) {
    const path = bloco.match(/path:\s*'([^']+)'/)
    if (!path) continue
    if (/meta:\s*\{[^}]*public:\s*true/.test(bloco)) encontrados.push(path[1])
  }

  return encontrados.sort()
}

describe('caminhos públicos', () => {
  /**
   * A lista existe duplicada por necessidade: o interceptador de erros não pode importar o roteador
   * sem fechar um ciclo de importação. Este teste é o que impede a duplicata de virar divergência.
   */
  test('a lista bate com o que o roteador marca como público', () => {
    assert.deepEqual([...CAMINHOS_PUBLICOS].sort(), caminhosPublicosDoRoteador())
  })

  test('reconhece só o caminho exato, não um prefixo dele', () => {
    assert.equal(emCaminhoPublico('/login'), true)
    assert.equal(emCaminhoPublico('/criar-conta'), true)
    assert.equal(emCaminhoPublico('/'), false)
    assert.equal(emCaminhoPublico('/produtos'), false)
    // Uma rota interna não vira pública por começar com o nome de uma pública.
    assert.equal(emCaminhoPublico('/loginhistorico'), false)
  })
})
