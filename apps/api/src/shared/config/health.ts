/**
 * Caminhos do healthcheck.
 *
 * O container chama `/health` direto na porta da API, mas o Caddy só encaminha
 * `/api/*`, então o mesmo teste responde nos dois caminhos. A lista mora aqui
 * porque quem registra as rotas (`app.ts`) e quem precisa ignorá-las no log de
 * requisições (`logs.hook.ts`) são arquivos diferentes: quando `/api/health`
 * nasceu, o hook continuou ignorando apenas `/health` e um monitor externo
 * batendo de minuto em minuto passou a gravar ~43 mil linhas por mês em
 * `system_logs`.
 */
export const HEALTH_PATHS = ['/health', '/api/health'] as const

export function isHealthPath(path: string | undefined): boolean {
  return path !== undefined && (HEALTH_PATHS as readonly string[]).includes(path)
}
