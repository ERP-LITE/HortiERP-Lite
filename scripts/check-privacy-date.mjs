/**
 * Confere (ou atualiza com --write) a data do aviso de privacidade contra o conteúdo dele.
 *
 * Por que não usar `new Date()` na tela: a data de um aviso de privacidade é o sinal que o leitor
 * usa para saber se as regras mudaram desde a última vez que leu. Se ela disser sempre "hoje", esse
 * sinal desaparece e o documento afirma uma revisão que não houve.
 *
 * E por que não derivar do build: o `rsync` do deploy exclui o `.git/`, e o checkout do CI
 * sobrescreve a data de modificação dos arquivos — qualquer data "automática" viraria a data do
 * deploy, que é o mesmo problema com outro nome.
 *
 * A saída é esta: a data continua escrita no arquivo, mas ninguém precisa lembrar dela. O
 * verificador guarda um resumo do texto do aviso; se o texto mudar e a data não, o CI reprova e
 * `npm run privacy:date -- --write` resolve os dois de uma vez.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const caminho = join(raiz, 'apps/web/src/modules/privacidade/PrivacyView.vue')

const LINHA_DATA = /^const atualizadoEm = '(.+)'$/m
const LINHA_RESUMO = /^const conteudoRevisado = '(sha256-[^']+)'$/m

const conteudo = await readFile(caminho, 'utf8')

const dataAtual = conteudo.match(LINHA_DATA)?.[1]
if (!dataAtual) {
  console.error(`Não achei a linha "const atualizadoEm = '...'" em ${caminho}.`)
  process.exit(1)
}

/**
 * O resumo cobre o arquivo inteiro **menos** as duas linhas de controle — senão gravar o resumo
 * mudaria o conteúdo que ele descreve, e a conferência nunca fecharia.
 */
function resumoDoTexto(texto) {
  const semControle = texto
    .split('\n')
    .filter((linha) => !LINHA_DATA.test(linha) && !LINHA_RESUMO.test(linha))
    .join('\n')
  return `sha256-${createHash('sha256').update(semControle).digest('base64')}`
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

// O resumo é calculado antes da escrita e ignora as linhas de controle, então gravar não o invalida.
await writeFile(caminho, atualizado)
console.log(`Aviso de privacidade atualizado para ${hoje}.`)
