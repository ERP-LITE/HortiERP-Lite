# Decisões arquiteturais

## Stack

Monorepo npm workspaces (`apps/api`, `apps/web`).

- **Backend**: Node.js + TypeScript, [Fastify](https://fastify.dev/), [Drizzle ORM](https://orm.drizzle.team/) + PostgreSQL, [Zod](https://zod.dev/) pra validação, `bcryptjs` pra hash de senha, `@fastify/jwt` + cookie httpOnly pra sessão.
- **Frontend**: Vue 3 + Vite + TypeScript, Tailwind CSS, Vue Router, Pinia, Axios.
- **Infra**: Docker Compose (Postgres + api + web), sem Redis/filas por enquanto.

## Multiempresa via `companyId`

Não existe conceito de "filial/setor dentro da mesma empresa" — cada cliente (frutaria) é uma linha em `companies`, e o isolamento entre clientes é garantido por um único mecanismo, repetido em todo módulo de negócio:

1. O login coloca `companyId` no payload do JWT (cookie httpOnly, nunca lido/setado pelo frontend).
2. Toda rota lê `request.user.companyId` e passa **manualmente** como primeiro argumento de toda função de serviço (`listCategories(companyId, query)`, `createProduct(companyId, userId, data)` etc.).
3. Toda query em toda tabela de negócio inclui `eq(<tabela>.companyId, companyId)` no `where` — não existe query "global" em nenhum módulo de negócio.

Não há tabela de junção usuário-empresa: um usuário pertence a exatamente uma `companyId`, fixada no registro dele. A única exceção é a sessão de impersonação (abaixo).

## Autenticação e sessão

- Login (`POST /auth/login`) verifica e-mail (único globalmente, não por empresa) + senha + [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) (proteção contra bots; chave de teste "sempre passa" em dev).
- Sessão = JWT assinado, guardado em cookie `httpOnly` + `sameSite=lax` (nunca exposto a JS no browser). Emissão centralizada em `apps/api/src/shared/auth/session.ts` (`issueSession`), reaproveitada por login, impersonação e saída de impersonação — evita duplicar a lógica de cookie/expiração em cada rota.
- Rate limit dedicado em `/auth/login` e `/auth/password` (10 req/min) além do rate limit global da API.

## Papéis e permissões

Enum `user_role`: `admin`, `gerente`, `operador`, `super_admin`. Middleware `requireRole(...roles)` (`shared/middlewares/auth.ts`) é usado como `preHandler` nas rotas que exigem um papel específico.

Padrão nos módulos de cadastro (categorias, unidades, produtos, usuários): leitura liberada pra qualquer autenticado, escrita (`POST`/`PUT`/`DELETE`) exige `admin` ou `gerente` (usuários exige `admin`).

**Exceção intencional**: `POST /stock-entries` e `POST /losses` **não têm `requireRole`** — qualquer usuário autenticado da empresa (inclusive `operador`) pode registrar entrada de mercadoria e perda. Isso é proposital: são operações do dia a dia do estoquista, não decisões gerenciais, então travar por papel só criaria fricção operacional sem ganho real de controle.

## Empresa da Plataforma e `super_admin`

`super_admin` é o papel do dono do sistema (quem vende o ERP pra novas frutarias), não de ninguém dentro de uma empresa-cliente. Como `users.companyId` é `NOT NULL` (sem tabela de junção — ver acima), o(s) usuário(s) `super_admin` precisam pertencer a **alguma** `companyId`. Em vez de tornar essa coluna nulável (o que forçaria revisar toda query que já assume `companyId` presente), existe uma empresa dedicada chamada **"Plataforma"**, criada uma única vez por um script de bootstrap (`apps/api/src/db/seedPlatform.ts`, rodado manualmente via `npm run db:seed:platform`) — nunca é uma empresa-cliente de verdade, só existe pra satisfazer a FK.

`super_admin` nunca é criável pela tela de cadastro de usuários de uma empresa-cliente (o Zod schema de `users` deliberadamente só aceita os outros 3 papéis). O primeiro acesso nasce pelo bootstrap; depois disso, um `super_admin` pode gerenciar outros usuários da plataforma na seção de configurações gerais. As rotas dedicadas sempre fixam `role: super_admin` e `companyId` na empresa Plataforma, e impedem que o usuário autenticado exclua a própria conta.

`companies` ganhou a coluna `active` (independente do `deletedAt` de soft-delete já existente) especificamente pra dar ao `super_admin` um jeito de **suspender/reativar** o acesso de um cliente sem apagar nada — login de qualquer usuário de uma empresa suspensa é bloqueado com a mesma mensagem genérica de credenciais inválidas (não revela o motivo). `setCompanyActive` espelha o mesmo valor de `active` em todos os usuários da empresa (numa transação junto com a empresa) — suspender desativa todo mundo, reativar reativa todo mundo. **Trade-off consciente**: um usuário que já estivesse desativado manualmente (por razão própria, sem relação com a suspensão) antes da empresa ser suspensa volta ativo junto com o resto ao reativar — hoje não existe uma coluna de rastreio pra distinguir "desativado pela suspensão" de "desativado por outro motivo".

Como a empresa "Plataforma" nunca deve ser suspensa nem aparecer misturada com empresas-cliente reais, `listCompanies` a exclui de toda listagem (via subquery que acha a `companyId` de qualquer usuário `super_admin`), e `setCompanyActive` rejeita explicitamente qualquer tentativa de suspendê-la (mesmo chamando o endpoint direto pelo id) — isso corrigiu um incidente real onde a Plataforma apareceu na tela de gestão de empresas e foi suspensa por engano, travando o próprio login do super_admin.

## Impersonação ("acessar como suporte")

O `super_admin` acessa os dados de uma empresa-cliente pra dar suporte sem precisar da senha de nenhum admin dela, e **sem virar** um usuário específico daquela empresa (evita a ambiguidade de "qual admin, se tiver vários" e mantém o rastro de auditoria apontando pra quem de fato agiu).

Mecanismo: o JWT ganha um campo opcional `realCompanyId`. Numa sessão normal ele não existe; numa sessão de impersonação:

- `sub` continua sendo o **próprio id do super_admin** (nome/e-mail exibidos na UI continuam sendo os dele).
- `companyId` (usado por toda query de negócio) passa a ser o da empresa acessada — isso sozinho já garante o isolamento de dados, sem precisar de nenhuma mudança nos outros módulos.
- `role` no token vira `admin` (não `super_admin`) — assim toda checagem `requireRole('admin', ...)` já existente nas rotas de negócio funciona sem alteração, e o `super_admin` fica automaticamente bloqueado de rotas exclusivas dele (`/companies`) enquanto estiver "dentro" de uma empresa.
- `realCompanyId` guarda a empresa real do super_admin — usado só pelos endpoints de "perfil próprio" (`/auth/me`, troca de senha) pra continuar achando a linha correta dele em `users`, já que `sub` + `companyId` (da empresa acessada) não bateria com nenhuma linha real.

Endpoints envolvidos: `POST /companies/:id/impersonate` (super_admin only — entra), `POST /auth/exit-impersonation` (volta pro próprio perfil de super_admin sem precisar de logout/login). O frontend mostra uma faixa fixa ("Você está acessando como suporte em X") com botão de voltar enquanto `impersonating` vier `true` de `/auth/me`/login/impersonate.

**Trade-off consciente**: como `createdBy`/`updatedBy` são colunas `uuid` **sem FK** (ver modelo de dados), qualquer ação feita durante a impersonação grava o id real do super_admin — correto para auditoria, mas não existe hoje uma tabela de log dedicada registrando "quando" e "em qual empresa" cada sessão de suporte aconteceu. Se isso passar a importar, é a extensão natural desse mecanismo.

## Soft delete e auditoria

- `deletedAt` (nulável) em quase toda tabela — "excluir" é sempre um `UPDATE ... SET deleted_at = now()`, nunca um `DELETE`. Toda query de listagem/busca filtra `isNull(deletedAt)`.
- `createdBy`/`updatedBy`: `uuid` solto, sem `references()` — decisão deliberada (não só uma omissão) que permite a impersonação funcionar sem violar integridade referencial mesmo quando quem agiu não pertence à empresa do registro.
- Categorias, unidades, produtos e usuários aceitam exclusão individual e em lote. A operação em lote recebe de 1 a 100 ids, aplica um único `UPDATE`, sempre combina os ids com o `companyId` da sessão e mantém as mesmas regras de papel da exclusão individual (`admin`/`gerente`; usuários somente `admin`).

## Paginação

Padrão único em todo módulo de listagem: `paginationQuerySchema` (Zod, `shared/schemas/pagination.schema.ts`) valida `page`/`pageSize` (máx. 100), e `buildPaginatedResult` (`shared/db/paginate.ts`) monta a resposta `{ data, page, pageSize, total, totalPages }`. Nenhum módulo reimplementa isso na mão.

## Logs técnicos e auditoria por empresa

Um hook global `onResponse` registra em `system_logs` as requisições da API, sem persistir corpo, senha, cookie ou token. Respostas 2xx/3xx são `info`, 4xx são `warning` e 5xx são `error`; o tratamento centralizado de erros anexa código e mensagem ao contexto antes da persistência.

- `GET /logs/technical`: exclusivo de `super_admin`, permite consultar todas as empresas e expõe contexto técnico (rota, status, duração, IP, navegador e erro).
- `GET /logs/activity`: exclusivo de `admin`, força o `companyId` da sessão no backend e retorna somente operações de escrita da própria empresa. Campos técnicos sensíveis são removidos da resposta.
- As próprias rotas de consulta de logs não geram novos registros, evitando ruído e crescimento recursivo.
