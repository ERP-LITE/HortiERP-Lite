/**
 * Trégua no redirecionamento para o login.
 *
 * Trocar a senha invalida no servidor todo token emitido antes dela, e o cookie novo só chega na
 * resposta do próprio PATCH. Entre uma coisa e outra existe uma janela em que qualquer requisição já
 * no ar leva o cookie morto e volta 401, inclusive a checagem de sessão que roda a cada 45 segundos
 * e ao focar a aba. Sem esta trégua, esse 401 manda para o login exatamente quem acabou de trocar a
 * senha com sucesso.
 *
 * A trégua vale só para o redirecionamento: o 401 continua sendo erro para quem chamou.
 */

const TREGUA_MS = 5000

export function criarTreguaDeSessao(agora: () => number = Date.now) {
  let suspensoAte = 0

  return {
    /** Chamado antes e depois da troca de senha, para cobrir também a resposta demorada. */
    iniciar() {
      suspensoAte = agora() + TREGUA_MS
    },
    ativa() {
      return agora() < suspensoAte
    },
  }
}

export const treguaDeSessao = criarTreguaDeSessao()
