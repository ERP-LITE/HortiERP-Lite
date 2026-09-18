/**
 * Travar a rolagem com `overflow: hidden` no corpo esconde a barra de rolagem, e aí a página escorrega
 * cerca de 15px para o lado ao abrir o modal. Compensar com recuo resolve o salto mas deixa um sulco
 * vazio no lugar da barra, igualmente visível. Aqui a barra continua desenhada e no mesmo lugar: a
 * trava barra o gesto de rolagem fora do sobreposto, em vez de tirar a barra da tela.
 *
 * Dentro do sobreposto a rolagem continua normal, e `overscroll-behavior: contain` no painel (main.css)
 * impede que ela transborde para a página ao chegar no fim. Arrastar o cursor da barra ainda rola, mas
 * é gesto deliberado e o navegador não deixa cancelar.
 *
 * O contador permite sobreposto dentro de sobreposto: só o primeiro trava e só o último destrava.
 */
// Listas suspensas e calendário são levados para o corpo, fora do painel, e precisam rolar por dentro.
const SOBREPOSTOS = '[role="dialog"], .swal2-container, [data-sobreposto]'
const GESTOS = ['wheel', 'touchmove'] as const

let sobrepostosAbertos = 0

function barrarGesto(evento: Event) {
  const alvo = evento.target
  const dentro = alvo instanceof Element && alvo.closest(SOBREPOSTOS) !== null
  if (!dentro && evento.cancelable) evento.preventDefault()
}

export function travarRolagem() {
  sobrepostosAbertos += 1
  if (sobrepostosAbertos > 1) return

  for (const gesto of GESTOS) {
    document.addEventListener(gesto, barrarGesto, { passive: false, capture: true })
  }
}

export function destravarRolagem() {
  if (sobrepostosAbertos === 0) return

  sobrepostosAbertos -= 1
  if (sobrepostosAbertos > 0) return

  for (const gesto of GESTOS) {
    document.removeEventListener(gesto, barrarGesto, { capture: true })
  }
}
