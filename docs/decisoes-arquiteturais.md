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

- Login (`POST /auth/login`) verifica e-mail (único globalmente, não por empresa) e senha. A rota mantém rate limit dedicado para reduzir tentativas automatizadas.
- Sessão = JWT assinado, guardado em cookie `httpOnly` + `sameSite=lax` (nunca exposto a JS no browser). Emissão centralizada em `apps/api/src/shared/auth/session.ts` (`issueSession`), reaproveitada por login, impersonação e saída de impersonação — evita duplicar a lógica de cookie/expiração em cada rota.
- Rate limit dedicado em `/auth/login` e `/auth/password` (10 req/min) além do rate limit global da API.
- Toda rota autenticada também confirma no banco que o usuário real, seu papel e a empresa da sessão continuam ativos. Em impersonação, tanto a empresa Plataforma do `super_admin` quanto a empresa acessada são verificadas. Assim, excluir/desativar usuário, mudar seu papel ou suspender uma empresa invalida imediatamente os JWTs já emitidos.
- O frontend valida `/auth/me` a cada 45 segundos e quando a aba volta ao foco/visibilidade. Isso não substitui a proteção por requisição do backend: serve para retirar proativamente da interface quem ficou parado numa tela depois de a empresa ser suspensa, o usuário ser desativado ou o papel ser alterado. Um `401` redireciona ao login com mensagem genérica, sem revelar a causa administrativa.
- O logout é idempotente e não exige que o JWT ainda seja válido: `POST /auth/logout` sempre tenta remover o cookie. O frontend também registra localmente a intenção de sair antes da chamada; se a API estiver indisponível, um F5 não restaura por engano o JWT que possa ter permanecido no navegador.
- **Logout por inatividade** (`composables/useIdleLogout.ts`): 30 minutos sem interação encerram a sessão, com um aviso e contagem regressiva no último minuto. Mouse, teclado, roda e toque contam como presença (com limite de um reset por segundo, para `mousemove` não reagendar o cronômetro a cada pixel). **Depois que o aviso aparece, só o clique explícito em "continuar conectado" conta**: um movimento incidental do mouse não deve dispensar o aviso em silêncio, senão o usuário nunca fica sabendo que a sessão ia cair. É proteção de estação desacompanhada — o backend continua com sua própria expiração de 8h no JWT, independente disso.

## Papéis e permissões

Enum `user_role`: `admin`, `gerente`, `operador`, `super_admin`. Middleware `requireRole(...roles)` (`shared/middlewares/auth.ts`) é usado como `preHandler` nas rotas que exigem um papel específico.

Padrão nos módulos de cadastro (categorias, unidades, produtos, usuários): leitura liberada pra qualquer autenticado, escrita (`POST`/`PUT`/`DELETE`) exige `admin` ou `gerente` (usuários exige `admin`).

**Exceção intencional**: `POST /stock-entries` e `POST /losses` **não têm `requireRole`** — qualquer usuário autenticado da empresa (inclusive `operador`) pode registrar entrada de mercadoria e perda. Isso é proposital: são operações do dia a dia do estoquista, não decisões gerenciais, então travar por papel só criaria fricção operacional sem ganho real de controle.

Já `POST /stock/adjust` (ajuste manual de estoque, ver [fluxos de negócio](./fluxos-de-negocio.md#ajuste-manual-de-estoque)) exige `admin`/`gerente`, no mesmo padrão dos cadastros. Diferente de entrada/perda, o ajuste sobrescreve diretamente o saldo calculado pelo sistema sem passar por nenhuma validação de origem — é uma correção, não uma operação rotineira, então fica sob controle gerencial.

O módulo `/billings` é uma exceção administrativa da plataforma: todas as rotas exigem `super_admin` em sessão
normal, e ficam inacessíveis durante impersonação. Ele registra recebimentos informados manualmente e não armazena
cartão, token bancário nem inicia transações financeiras. Por lidar com dinheiro, `company_billings` é a única tabela
cujas colunas de auditoria (`created_by`/`updated_by`) declaram chave estrangeira para `users` com `on delete set
null`, em vez de usar o `auditBy` compartilhado — o resto do sistema aceita um uuid solto ali, aqui não.

A situação de cada cobrança (`pago`, `pendente`, `atrasado`) é derivada no `select`, junto do mesmo `today` que monta
o filtro por status — a tela só exibe o que o banco calculou. Regra duplicada em SQL e em JavaScript acabaria
divergindo justamente na virada do dia, quando a diferença aparece pro usuário.

## Empresa da Plataforma e `super_admin`

`super_admin` é o papel do dono do sistema (quem vende o ERP pra novas frutarias), não de ninguém dentro de uma empresa-cliente. Como `users.companyId` é `NOT NULL` (sem tabela de junção — ver acima), o(s) usuário(s) `super_admin` precisam pertencer a **alguma** `companyId`. Em vez de tornar essa coluna nulável (o que forçaria revisar toda query que já assume `companyId` presente), existe uma empresa dedicada chamada **"Plataforma"**, criada uma única vez por um script de bootstrap (`apps/api/src/db/seedPlatform.ts`, rodado manualmente via `npm run db:seed:platform`) — nunca é uma empresa-cliente de verdade, só existe pra satisfazer a FK.

Empresas-cliente novas exigem cadastro comercial completo. Os campos acrescentados continuam nuláveis no PostgreSQL por compatibilidade com a empresa Plataforma e instalações anteriores; a obrigatoriedade fica na validação do endpoint de criação. Documentos são normalizados antes da persistência, e um índice parcial garante CNPJ único entre registros não excluídos mesmo sob requisições concorrentes.

A consulta de CEP é uma conveniência do frontend, não uma fonte autoritativa nem uma condição para salvar: os campos podem ser corrigidos manualmente. O cliente tenta sequencialmente BrasilAPI, ViaCEP e OpenCEP, com timeout por provedor. Essa redundância evita indisponibilidade do cadastro quando um serviço gratuito falha e não acrescenta credenciais ou dados pessoais à requisição — somente os oito dígitos do CEP são enviados.

`super_admin` nunca é criável pela tela de cadastro de usuários de uma empresa-cliente (o Zod schema de `users` deliberadamente só aceita os outros 3 papéis). O primeiro acesso nasce pelo bootstrap; depois disso, um `super_admin` pode gerenciar outros usuários da plataforma na seção de configurações gerais. As rotas dedicadas sempre fixam `role: super_admin` e `companyId` na empresa Plataforma, e impedem que o usuário autenticado exclua a própria conta.

`companies` ganhou a coluna `active` (independente do `deletedAt` de soft-delete já existente) especificamente pra dar ao `super_admin` um jeito de **suspender/reativar** o acesso de um cliente sem apagar nada — login de qualquer usuário de uma empresa suspensa é bloqueado com a mesma mensagem genérica de credenciais inválidas (não revela o motivo).

`setCompanyActive` mexe **somente** na linha da empresa. `users.active` guarda a decisão individual do admin (funcionário desligado, por exemplo) e não é sobrescrito pela suspensão. A versão anterior espelhava o valor em todos os usuários da empresa, e isso tinha um efeito indesejado: quem tivesse sido desativado à mão *antes* da suspensão voltava ativo junto com o resto na reativação, recuperando acesso que ninguém quis devolver. Não é preciso coluna de rastreio para distinguir os dois motivos — o espelhamento simplesmente não é necessário, porque tanto o login (`authenticateUser`) quanto toda requisição autenticada (`authenticate`) já exigem `companies.active`. Suspender continua invalidando na hora os JWTs em circulação.

Como a empresa "Plataforma" nunca deve ser suspensa nem aparecer misturada com empresas-cliente reais, `listCompanies` a exclui de toda listagem (via subquery que acha a `companyId` de qualquer usuário `super_admin`), e `setCompanyActive` rejeita explicitamente qualquer tentativa de suspendê-la (mesmo chamando o endpoint direto pelo id) — isso corrigiu um incidente real onde a Plataforma apareceu na tela de gestão de empresas e foi suspensa por engano, travando o próprio login do super_admin.

São **quatro** as portas que precisam recusar a Plataforma, e vale enumerá-las porque a terceira ficou aberta por um tempo: `listCompanies` (esconde), `setCompanyActive` (não suspende), `assertBillableCompany` (não fatura) e `assertCompanyAccessible` (não acessa como suporte). Esta última é a de efeito mais grave: entrando na Plataforma como suporte, a sessão passa a valer como `admin` **dela**, e aí os próprios `super_admin` aparecem na tela comum de usuários — onde podem ser rebaixados para `operador` ou excluídos, exatamente o que `/platform-users` proíbe de propósito (ela só aceita nome, e-mail e senha). Rebaixando todos, ninguém mais acessa `/empresas` nem `/cobrancas`, e não existe tela para desfazer: só SQL.

A recusa é repetida em dois níveis. `assertCompanyAccessible` barra na entrada, e `authenticate` barra a sessão já emitida comparando `realCompanyId` com `companyId`: numa impersonação legítima o super_admin entra em **outra** empresa, então os dois valores nunca coincidem. Essa segunda checagem existe porque o JWT vive 8h no cookie — sem ela, uma sessão aberta antes da correção continuaria valendo até expirar. Por ser só a forma do token, não custa consulta nenhuma.

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
- **Exceção**: `company_billings` apaga a linha de verdade, pelos motivos descritos em [fluxos de negócio](./fluxos-de-negocio.md#controle-manual-de-cobranças). A coluna `deleted_at` continua existindo ali porque vem do helper `timestamps`, mas não é usada — o mesmo já acontece em `losses` e `stock_entries`, que não expõem exclusão nenhuma.
- `createdBy`/`updatedBy`: `uuid` solto, sem `references()` — decisão deliberada (não só uma omissão) que permite a impersonação funcionar sem violar integridade referencial mesmo quando quem agiu não pertence à empresa do registro. `company_billings` é a única tabela que declara a FK para `users` (`on delete set null`): ela nunca é escrita durante impersonação, e por lidar com dinheiro compensa amarrar o responsável.
- Categorias, unidades, produtos e usuários aceitam exclusão individual e em lote. A operação em lote recebe de 1 a 100 ids, aplica um único `UPDATE`, sempre combina os ids com o `companyId` da sessão e mantém as mesmas regras de papel da exclusão individual (`admin`/`gerente`; usuários somente `admin`).
- **Falha de auditoria nunca derruba a operação do usuário.** `recordActivity` aceita um `executor` para participar da mesma transação da operação auditada — numa entrada de mercadoria que falha no meio, o histórico não pode ficar afirmando que a entrada foi criada. Fora de transação, as versões `recordActivitySafe`/`recordActivitiesSafe` engolem o erro: perder uma linha de histórico é ruim, impedir o lançamento de uma perda é pior.
- Os quatro módulos compartilham `softDeleteManyWithActivity` (`shared/db/softDelete.ts`), que lê os rótulos, exclui e registra o histórico. Antes cada service repetia esse corpo quase idêntico, e o registro saía num laço de até 100 `insert` separados — hoje é um `insert` só, via `recordActivitiesSafe`. Os nomes continuam sendo lidos **antes** do `UPDATE`: depois da exclusão o histórico não teria como dizer o que saiu, que é justamente o que se quer auditar.

## Paginação

Padrão único em todo módulo de listagem: `paginationQuerySchema` (Zod, `shared/schemas/pagination.schema.ts`) valida `page`/`pageSize` (máx. 100), e `buildPaginatedResult` (`shared/db/paginate.ts`) monta a resposta `{ data, page, pageSize, total, totalPages }`. Nenhum módulo reimplementa isso na mão.

Os detalhamentos dos relatórios de perdas e entradas também seguem esse contrato. No frontend, listas usadas como opções de formulário percorrem todas as páginas por meio de `services/paginatedOptions.ts`; assim, o limite de 100 por requisição não oculta opções de empresas com cadastros maiores.

O `pageSize` escolhido é guardado no `localStorage` e vale como **padrão único para todas as tabelas** (`composables/usePagination.ts`): quem prefere 50 linhas por página não precisa reajustar tela por tela. Já a página atual e o total continuam por tabela, cada uma com seu próprio estado.

## Planilhas (importação e exportação CSV)

Todo CSV do sistema é feito para o **Excel em português**, que é de onde as planilhas dos clientes vêm e para onde os relatórios voltam. Três decisões saem daí (`lib/csv.ts`):

- **Separador `;`** — com `,` o Excel em português joga a linha inteira numa célula só.
- **BOM (`U+FEFF`) no início do arquivo** — é o que faz o Excel reconhecer o arquivo como UTF-8; sem ele os acentos saem corrompidos.
- **Vírgula decimal nos números** — sem isso o Excel trata `7.49` como texto (ou pior, como data) e a coluna exportada não soma. Como o separador de campo é `;`, a vírgula decimal não conflita com nada.

Na leitura, o arquivo é decodificado como UTF-8 e, se aparecer o caractere de substituição (indicando bytes inválidos), a tentativa é repetida em Windows-1252 — que o Excel ainda usa ao salvar. O parser também trata aspas duplicadas dentro de campo entre aspas como uma aspa literal, `\r\n` como uma quebra só, e ignora a linha vazia final que o Excel costuma deixar.

Na importação, `lib/productSpreadsheet.ts` aceita variações de cabeçalho (comparando sem acento, caixa e pontuação), porque a planilha do cliente raramente usa o cabeçalho exato do modelo. A numeração das linhas enviada à API é deslocada em 2 (cabeçalho + planilha começa em 1) para que **o número que aparece no erro seja o mesmo que o cliente vê aberto no Excel**.

Campos textuais potencialmente extensos nas tabelas usam o componente compartilhado `ExpandableText`: a célula mantém largura limitada, exibe uma prévia e permite expandir pelo chevron sem provocar overflow horizontal. O componente força a quebra de sequências sem espaços e libera o conteúdo completo para impressão. Esse comportamento é independente do `v-mobile-accordion`, responsável por transformar linhas de tabela em cartões expansíveis em telas pequenas.

### Tabelas em telas pequenas

Toda listagem precisa de um tratamento explícito abaixo do breakpoint `sm` (640px) — sem ele a tabela fica mais larga
que a tela e o usuário passa a arrastar na horizontal para ler qualquer coisa. Há dois caminhos aceitos:

- **`v-mobile-accordion`** (padrão, usado pela maioria das listagens): a diretiva converte cada `<tr>` em cartão,
  esconde o `<thead>` e prefixa cada célula com o rótulo da coluna correspondente. A primeira célula com rótulo vira o
  resumo clicável; as demais aparecem ao expandir. A célula de ações só é reconhecida como tal se o `<th>`
  correspondente estiver **vazio** — daí a ausência de um cabeçalho "Ações" nas tabelas.
- **Cartões próprios** (`StockView`, `StockMovementsView`, `StockEntryDetailsView`): um bloco `sm:hidden` com
  `<article>` por registro e a tabela marcada como `hidden sm:table`. Vale quando o cartão precisa de um arranjo
  diferente da ordem das colunas.

Não existe um terceiro caminho. `StockEntryDetailsView` usou por um tempo apenas `overflow-x-auto` em volta da tabela
de itens, e o resultado engana: a **página** não estoura (o `scrollWidth` continua igual ao viewport, porque o excesso
rola dentro do cartão), mas a terceira coluna — justamente o custo unitário — fica fora da área visível, e o nome do
produto quebra no meio da palavra por competir com as outras duas colunas em 320px. Conferir só overflow de página não
detecta esse caso; é preciso olhar se cada valor está dentro do `innerWidth`.

**Clique na linha não pode competir com o acordeão.** Onde a linha inteira abre um detalhe no desktop, o `@click` do
`<tr>` tem que ser guardado por `useIsMobile()`. Sem isso o mesmo toque dispara os dois comportamentos — o modal abre e
o cartão alterna atrás dele, tornando impossível expandir o cartão para ler as outras colunas. No mobile o caminho para
o detalhe é o botão de ação (ícone de olho), que continua funcionando nos dois tamanhos de tela. É a regra que
`ActivityLogsView` e `SystemLogsView` seguem.

**Alvo de toque.** Botões que só existem no mobile precisam de área clicável de ~44px mesmo que o ícone seja menor —
caso do botão que abre o menu lateral no `AppLayout`, onde o ícone tem 22px e o botão, 44px.

Datas escolhidas na interface usam o `DateInput` compartilhado, com calendário próprio em português, compatível com
tema claro/escuro e renderizado acima de modais. Isso evita diferenças de idioma e aparência dos seletores nativos
de cada navegador, mantendo o valor técnico enviado à API no formato ISO `AAAA-MM-DD`.

"Hoje" nunca sai de `new Date().toISOString()`: isso devolve a data em UTC, que a partir das 21h de Brasília já é o
dia seguinte — uma cobrança venceria hoje e apareceria como atrasada no fim da tarde. O front usa `todayIso()`
(`lib/period.ts`), com o relógio local do usuário, e a API usa `todayIsoDate()` (`shared/utils/date.ts`), fixado em
`America/Sao_Paulo` porque os containers rodam em UTC.

### Filtro de período nas listagens

O front manda a data civil escolhida pelo usuário, sem hora. `from` e `to` **nunca** são lidos com
`z.coerce.date()`: essa função coloca a string na meia-noite **UTC**, então `to=2026-08-14` significava "até as 21h
de 13/08 em Brasília" — o preset "hoje" devolvia zero mesmo com lançamento feito pela manhã, e todo preset perdia o
dia final inteiro. Em vez disso, todo módulo com filtro de data estende `periodQueryFields`
(`shared/schemas/period.schema.ts`), que expande cada ponta para a borda correta do dia no fuso do negócio: `from`
vira `00:00:00.000` e `to` vira `23:59:59.999` locais. Um `AAAA-MM-DDTHH:MM:SSZ` completo continua aceito e é usado
como veio; uma data impossível (`2026-13-45`) é recusada com 422 em vez de rolar silenciosamente para outro mês.

As bordas saem de `startOfBusinessDay`/`endOfBusinessDay` (`shared/utils/date.ts`), que descobrem o deslocamento do
fuso via `Intl` em duas passadas em vez de assumir -03:00 fixo — o Brasil já teve horário de verão e pode ter de novo.
Nenhum service ajusta hora na mão: fazer isso com `setHours` usa o relógio do container (UTC) e reintroduz o bug.

A timeline diária do dashboard agrupa por `date_trunc('day', created_at at time zone 'America/Sao_Paulo')`, e não pelo
`created_at` cru: sem a conversão, uma perda registrada às 22h aparecia no gráfico no dia seguinte. O fuso entra na
consulta como literal (`sql.raw`) e não como parâmetro, porque a mesma expressão precisa sair idêntica no `select` e no
`group by` — dois placeholders distintos fariam o Postgres tratá-los como expressões diferentes. Os limites do período
também são resolvidos em datas civis (`resolvePeriod`), o que de passagem fez o teto de 90 dias render 90 dias, e não 91.

Os controles da barra de ações das listagens (busca, filtro, impressão e o botão de novo registro) têm todos `h-10`.
A altura mora nos componentes compartilhados (`BaseButton`, `SearchInput`, `FilterButton`, `PrintButton`), não nas
telas — ajustar tamanho por view era o que fazia os botões saírem desalinhados entre si.

Formulários com validação própria usam `novalidate`: mensagens nativas do navegador não competem com o retorno
padronizado da aplicação. Campos inválidos recebem borda vermelha e uma mensagem em vermelho logo abaixo do
componente, inclusive selects, competência e calendário.

## Ordenação das listagens

`sortOrder` (`asc`/`desc`) mora no `paginationQuerySchema` compartilhado; cada módulo declara seu próprio `sortBy` como `z.enum([...])` com as colunas que aquela tela expõe. **Nenhum nome de coluna vindo do cliente entra em SQL**: o enum validado é usado para indexar a tabela do Drizzle ou um mapa explícito de colunas, então um valor fora da lista é rejeitado pelo Zod antes de chegar ao banco.

A expressão de ordenação sai de `shared/db/sorting.ts`, e não de `asc()`/`desc()` soltos em cada service, para que três decisões fiquem num lugar só:

- **`nulls last` sempre.** No Postgres, `desc` traz os nulos primeiro por padrão. Sem isso, ordenar produtos por custo decrescente colocaria justamente os produtos *sem* custo cadastrado no topo da tela.
- **Direção padrão explícita por módulo.** Cadastros assumem `asc` (nome), listagens temporais assumem `desc` (mais recente primeiro). Antes cada service repetia essa escolha na mão e elas divergiam entre módulos para quem chamasse a API sem mandar `sortOrder`.
- **Enums ordenam pelo rótulo, não pela ordem de declaração.** `orderByLabeledEnum` monta um `CASE` que ordena `loss_reason` e `movement_type` na ordem alfabética dos textos exibidos na tela; ordenar pelo enum cru produziria uma sequência (`vencido → avariado → ...`) que não corresponde a nada visível. A exceção é `systemLogs.level`, que fica na ordem de declaração de propósito, porque ali ela equivale à ordem de severidade.

Toda listagem aplica ainda um segundo critério estável (nome ou data) como desempate, e o frontend volta para a página 1 ao trocar a ordenação — o `useTableSort` recebe o `reload` já com esse reset.

## Integridade e índices

Além das validações amigáveis dos services, nomes de categorias, unidades e produtos, abreviações/SKUs e o e-mail de usuário possuem índices únicos parciais que ignoram maiúsculas. Os índices consideram apenas registros com `deletedAt` nulo, preservando o comportamento de soft delete — o de usuário é global, os demais são por empresa (ver [modelo de dados](./modelo-de-dados.md#users)). Consultas operacionais frequentes também possuem índices compostos por empresa/data ou empresa/produto.

A checagem existe **duas vezes de propósito**: o service confere antes do insert para devolver um erro amigável apontando o campo, e o índice segura o caso de duas requisições simultâneas passarem as duas pela checagem. O que não pode existir duas vezes é o **texto** da mensagem: campo e mensagem de cada índice moram só em `shared/db/uniqueConstraints.ts`, indexados pelo nome real do índice no PostgreSQL — que é o que o driver devolve no campo `constraint` do erro `23505`. Os dois caminhos (checagem amigável e tradução do erro no `errorHandler`) leem o mesmo mapa, porque levam à mesma tela e divergiam sem ninguém notar quando cada um guardava a própria cópia. `uniqueViolationConstraint`, no mesmo arquivo, é quem reconhece o `23505` — inclusive quando o Drizzle embrulha o erro do driver dentro de uma transação e o código sai do nível de cima.

A única captura local de duplicidade que sobrou é a de `createCompanyWithAdmin`, e só para trocar o rótulo do campo: naquele formulário o campo se chama `adminEmail`, não `email`, e a mensagem precisa aparecer embaixo do campo que existe na tela.

## Mensagens de erro sempre em português

Toda mensagem que chega ao cliente é em português. Isso é fácil de garantir nos erros que o próprio sistema levanta (`AppError` e Zod), e é justamente onde a regra vazava: **erros do Fastify e dos seus plugins nascem em inglês**, e o `errorHandler` repassava `error.message` sem olhar em qualquer 4xx que não fosse `AppError`. Foi assim que `Rate limit exceeded, retry in 53 seconds` apareceu na tela do usuário.

A tradução mora em `shared/errors/frameworkMessages.ts`, e `frameworkErrorMessage` resolve em duas camadas: primeiro pelo código do erro (`FST_REQ_FILE_TOO_LARGE`, `FST_ERR_CTP_INVALID_MEDIA_TYPE`, …), e, sem código conhecido, pela mensagem genérica do status HTTP. A função **nunca devolve `undefined`** — é o que garante que um plugin novo, com códigos que ninguém mapeou, degrade para um texto genérico em português em vez de voltar a vazar inglês.

O texto original em inglês não é jogado fora: o `errorHandler` mantém a mensagem crua em `request.technicalError`, que é o que vai para `system_logs`. O usuário lê português, o operador continua com o texto do framework para depurar.

Dois erros precisaram de tratamento na origem, e não no `errorHandler`:

- **Excesso de requisições:** o `errorResponseBuilder` do `@fastify/rate-limit` levanta um `AppError`, para a resposta sair no mesmo envelope de todo o resto. O tempo de espera é calculado a partir de `context.ttl` (milissegundos), **não** do campo `context.after` do plugin — que já vem formatado em inglês (`"53 seconds"`) e daria uma tradução por interpretação de texto.
- **Endereço inexistente:** o 404 padrão do Fastify não passa pelo `errorHandler` e usa outro formato de corpo (`{ message, error, statusCode }`), então o frontend nem achava a mensagem e caía no texto genérico. Um `setNotFoundHandler` levanta `AppError.notFound`, unificando idioma e envelope.

O anexo grande demais é um caso à parte e vale registrar, porque a documentação do `@fastify/multipart` engana: com `throwFileSizeLimit` ligado (o padrão), o erro `FST_REQ_FILE_TOO_LARGE` só é levantado por `toBuffer()` ou pelo iterador de partes. Quem consome `file.file` por conta própria — é o que `invoice-storage.ts` faz, gravando direto em disco com `pipeline` para não carregar 10 MB na memória — recebe um stream que **termina normalmente**, apenas com `truncated` marcado. Sem a checagem explícita de `file.file.truncated`, o upload responderia `201` com o arquivo cortado. A frase com o limite em MB mora em `fileTooLargeMessage`, junto do mapa de traduções, e é usada tanto por essa checagem quanto pelo código do framework — para os dois caminhos nunca divergirem.

## Logs técnicos e auditoria por empresa

Um hook global `onResponse` registra em `system_logs` as requisições da API, sem persistir corpo, senha, cookie ou token. Respostas 2xx/3xx são `info`, 4xx são `warning` e 5xx são `error`; o tratamento centralizado de erros anexa código e mensagem ao contexto antes da persistência.

- `GET /logs/technical`: exclusivo de `super_admin`, permite consultar todas as empresas e expõe contexto técnico (rota, status, duração, IP, navegador e erro).
- `GET /logs/activity`: exclusivo de `admin`, força o `companyId` da sessão no backend e retorna somente operações de escrita da própria empresa. Campos técnicos sensíveis são removidos da resposta.
- As próprias rotas de consulta de logs não geram novos registros, evitando ruído e crescimento recursivo.
- **Healthcheck também não gera registro.** Os caminhos ficam em `shared/config/health.ts` (`HEALTH_PATHS`), lista consumida tanto por quem registra as rotas (`app.ts`) quanto por quem as ignora no hook (`logs.hook.ts`). Quando `/api/health` nasceu, o hook continuou ignorando apenas `/health` e um monitor externo batendo de minuto em minuto passou a gravar cerca de 43 mil linhas por mês em `system_logs` — a lista compartilhada existe para que acrescentar um caminho de saúde não dependa de lembrar do segundo arquivo.

As ações registradas em `activity_logs` são `criou`, `alterou`, `excluiu`, `importou`, `ajustou` e `cancelou`. A coluna é `text` livre no banco, mas o conjunto é fechado em três lugares que precisam andar juntos: o tipo `ActivityAction` (backend), o `activityActionSchema` do filtro e os mapas de rótulo e cor da tela de auditoria (`ActivityLogsView.vue`) — o `vue-tsc` acusa se algum ficar para trás, porque os mapas são `Record<ActivityAction, …>`.

`system_logs` e `activity_logs` **não têm política de retenção automática**. Em instalação de longa duração são as tabelas que mais crescem e dominam o tamanho do backup; a limpeza é hoje uma decisão manual do operador. Ver [deploy-producao.md](./deploy-producao.md).

## Correção de lançamentos operacionais

Entradas, perdas e movimentações são históricos: nenhuma delas oferece exclusão. Mas errar o lançamento é normal, e a resposta é a mesma nos dois fluxos que têm correção — **separar o que é descritivo do que mexe no estoque**:

- **Campos descritivos** (fornecedor, dados fiscais, motivo, observações) são editáveis por `admin`/`gerente`. Não afetam saldo nem período.
- **Produto, quantidade e data** são imutáveis. Editá-los alteraria o estoque retroativamente e moveria o registro entre períodos já conferidos, além de reabrir a mutabilidade do custo congelado em `unitCost`.

A diferença entre os dois fluxos está no que se faz quando é justamente a quantidade ou o produto que está errado:

- **Perda** tem cancelamento (`POST /losses/:id/cancel`): marca `cancelledAt`, devolve a quantidade ao estoque como `ajuste` com `referenceType: 'loss_cancellation'` e tira o registro dos relatórios. Isso é possível porque devolver estoque é incremento — nunca falha por saldo insuficiente.
- **Entrada** não tem: estornar uma entrada é decremento e poderia deixar o saldo negativo se a mercadoria já saiu. Ali a correção continua sendo o ajuste manual de estoque.

O cancelamento de perda existe porque o ajuste manual, embora conserte o **saldo**, deixa o registro da perda intacto — e portanto o "valor perdido no período" do painel e o relatório de perdas seguiriam inflados. Num sistema cujo propósito é medir desperdício, esse número errado é o dano principal, não o saldo.
