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

### Categoria e unidade em uso não podem ser excluídas

`assertNotUsedByProducts` (`shared/db/assertNotUsedByProducts.ts`) conta os produtos não excluídos que
apontam para os ids e responde `409` antes de qualquer `UPDATE`, na exclusão individual e na em lote.
Em lote é tudo ou nada: uma unidade em uso na seleção recusa a operação inteira, pelo mesmo motivo da
importação de planilha, que é não deixar o usuário sem saber o que entrou e o que não entrou.

O que acontecia antes merece registro, porque o estrago não era visível. `products` guarda `unitId` e
`categoryId`, e as consultas que trazem o produto com a unidade usam a relação do Drizzle
(`with: { unit: true }`), que **não filtra `deletedAt`**. Então excluir uma unidade em uso não sujava
nenhuma lista: estoque, relatórios e painel seguiam mostrando "kg" como antes. A conta só chegava na
edição do produto, onde as opções de unidade vêm de `listAllUnits` (que filtra excluídas): o campo
abria vazio, a validação exigia unidade e o produto não salvava mais sem trocar a unidade dele.

### Inativar é o caminho para aposentar categoria e unidade

Bloquear a exclusão resolve a integridade, mas deixava um beco sem saída: cadastro em uso não podia sair
das opções de produto novo de jeito nenhum. Daí a coluna `active` em `units` e `categories`
(migration `0008`), com três regras:

- **Produto novo não aceita cadastro inativo** (`409`). Quem valida é `assertCategoryAndUnitUsable`.
- **Produto que já usa o cadastro inativo continua editável.** É a regra que exige cuidado: a tela manda
  o formulário inteiro no `PUT`, incluindo a unidade atual, então uma checagem ingênua recusaria salvar
  qualquer alteração naquele produto. `updateProduct` passa os ids atuais para a validação, que só
  recusa inativo quando o id **mudou**.
- **A importação de planilha enxerga as inativas.** Ela casa unidade por nome e abreviação; sem ver as
  inativas, `createMissingRefs` tentaria criar uma unidade com nome repetido e bateria no índice único
  (`units_company_name_active_unique`, que ignora só as excluídas). A linha é aceita, reaproveitando o
  cadastro, e a conferência antes de confirmar marca a unidade com a etiqueta "inativa" para ninguém
  importar 300 produtos numa unidade aposentada sem perceber.

Nas opções de produto, o `select` mostra as ativas mais a do próprio produto quando ela está inativa,
com o rótulo dizendo isso. A exclusão continua bloqueada para cadastro em uso, e a mensagem agora
oferece a alternativa: trocar a unidade dos produtos, ou apenas inativar.

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
  resumo clicável; as demais aparecem ao expandir. A célula de ações é reconhecida pelo **rótulo vazio**, e é isso que
  a transforma na barra de botões alinhada à direita, sem prefixo. Por causa disso o cabeçalho "Ações", que existe no
  desktop para a coluna de ícones não ficar sem nome, é marcado com `data-actions` no `<th>`: a diretiva lê esse
  atributo e trata a coluna como se o título fosse vazio. Sem o atributo, acrescentar o título transformaria a barra de
  ações em mais uma linha rotulada do cartão.
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

O calendário é `position: fixed` fora do fluxo (para escapar do `overflow` de modais e tabelas), então a posição é
calculada em JavaScript — e ela usa a **altura medida** do calendário já renderizado, não uma estimativa. A estimativa
anterior era menor que ele, e existia uma faixa de alturas de tela em que sobrava espaço suficiente pela conta mas não
de verdade: abria para baixo e cortava o rodapé com "Limpar"/"Hoje", sem possibilidade de rolar até ele. A posição
final é limitada à janela nas duas pontas, então não cabendo nem acima nem abaixo o calendário encosta na borda em vez
de sair da tela. Como a altura depende da largura aplicada, a medição acontece em duas passadas de `nextTick`.

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

A timeline diária do dashboard agrupa por `date_trunc('day', movement_date at time zone 'America/Sao_Paulo')`, e não
pela coluna crua: sem a conversão, uma perda registrada às 22h aparecia no gráfico no dia seguinte. A coluna é
`movement_date` (a data do fato) e não `created_at` — ver [Data do fato e data do lançamento](#data-do-fato-e-data-do-lançamento). O fuso entra na
consulta como literal (`sql.raw`) e não como parâmetro, porque a mesma expressão precisa sair idêntica no `select` e no
`group by` — dois placeholders distintos fariam o Postgres tratá-los como expressões diferentes. Os limites do período
também são resolvidos em datas civis (`resolvePeriod`), o que de passagem fez o teto de 90 dias render 90 dias, e não 91.

Os controles da barra de ações das listagens (busca, filtro, impressão e o botão de novo registro) têm todos `h-10`.
A altura mora nos componentes compartilhados (`BaseButton`, `SearchInput`, `FilterButton`, `PrintButton`), não nas
telas — ajustar tamanho por view era o que fazia os botões saírem desalinhados entre si.

Formulários com validação própria usam `novalidate`: mensagens nativas do navegador não competem com o retorno
padronizado da aplicação. Campos inválidos recebem borda vermelha e uma mensagem em vermelho logo abaixo do
componente, inclusive selects, competência e calendário.

### Modal alto: um trecho elástico, nunca dois

O modal de importação passou a estourar a altura da tela: o painel ganhava barra de rolagem e os
botões ficavam abaixo da borda. O `BaseModal` tem agora o modo `fit`, usado só por esse modal: de
`sm` para cima o painel deixa de rolar (`flex flex-col` com `overflow-hidden`), o cabeçalho e o rodapé
ficam fixos e o conteúdo se encaixa na altura disponível. No celular o painel continua rolando como
sempre, porque encaixar deixaria as listas com duas linhas.

A primeira tentativa dessa mudança **quebrou a tela**, e a lição vale para qualquer modal: dois blocos
irmãos com `flex-1` (base zero) num contêiner sem espaço suficiente não dividem o que sobra. Um deles
colapsa para perto de zero, e como o filho tem altura mínima própria, ele **vaza para fora do bloco** e
desenha por cima do conteúdo seguinte. Na tela, a lista do que ia ser importado apareceu por cima do
título "O que precisa ser corrigido".

O arranjo correto é **um único item elástico** entre irmãos `shrink-0`. E para haver só um, as duas
listas viraram **abas**: "Prontas (N)" e "Com problema (M)", com uma lista na tela por vez, ocupando
toda a altura livre (`sm:min-h-0 sm:flex-1`) e rolando por dentro. Isso resolve de uma vez o colapso e
o caso de 50 linhas prontas com 50 erradas, em que as duas listas juntas produziam rolagem dentro de
rolagem: o trecho rolava para alcançar a segunda lista, e a lista rolava por dentro. A explicação do
botão fica fora da parte que rola, porque ela é o que justifica o "Importar as N válidas".

Duas coisas saíram de cena para o espaço sobrar na tela de 768px de altura: os três cartões de
contador viraram uma linha de texto (as abas já mostram "prontas" e "com problema", então os cartões
repetiam o mesmo número em letra grande) e o link da planilha modelo, que só faz sentido antes de
escolher o arquivo. Com isso a lista aberta ganhou cerca de 90px, o que em 1366x768 é a diferença
entre duas e cinco linhas visíveis.

Medido com Chrome headless em 1280x800, 1366x768 e 1920x1080, com 50 linhas prontas e 50 com
problema: painel sem rolagem, rodapé sempre visível, nenhuma sobreposição, e a lista aberta crescendo
de 250px para 546px conforme a tela, sempre com uma única barra de rolagem.

### Importação parcial precisa de um caminho de volta

A importação de planilha era tudo ou nada, e o motivo estava escrito na tela: importar metade e
reenviar a planilha corrigida faria o que já entrou voltar como nome duplicado. O problema é que numa
planilha de 100 produtos com 50 prontos, a regra obrigava a mexer no arquivo inteiro antes de
conseguir qualquer coisa.

O modo padrão continua o mesmo (nada entra se houver linha inválida). O que existe agora é a escolha
explícita: com linha com problema, o botão passa a ser **Importar as N válidas** e a API recebe
`skipInvalid`. Duas coisas fazem esse caminho fechar em vez de virar bagunça:

- **A lista de erros virou planilha de reenvio.** Ela sai com as colunas do modelo e uma coluna de
  motivo no fim, com os valores originais das linhas recusadas. O usuário corrige aquele arquivo e
  envia **só ele**, o que evita justamente a duplicação que motivava o tudo ou nada. Antes o download
  tinha linha, nome e problema, e servia para ler, não para reenviar.
- **A janela continua aberta depois da importação parcial**, mostrando o que entrou e o que ficou de
  fora. Fechar na hora jogaria fora a única lista das 50 linhas que faltam.

E uma armadilha que só aparece na importação parcial: categoria e unidade novas eram coletadas durante
a validação de **todas** as linhas, antes de saber quais seriam aceitas. Como no modo antigo nada era
gravado quando havia erro, isso nunca fez diferença. Com importação parcial, uma linha recusada que
citasse uma categoria inédita criaria essa categoria sem nenhum produto dentro. Hoje as duas listas
são filtradas pelas linhas aceitas, o que também deixa os contadores da prévia dizendo a verdade
sobre o que aquele botão vai criar.

### "Com nota" não podia significar duas coisas

A coluna **Nota fiscal** da listagem de entradas mostrava só dois estados, e o verde saía com
`invoiceNumber || invoiceAccessKey || anexos`. Quem digitou o número da nota e não conseguiu anexar o
arquivo via "Com nota" na tela, sem ter nota nenhuma guardada. Agora são três estados: **Anexada**
(verde, existe arquivo), **Sem arquivo** (âmbar, os dados da nota estão lá e o arquivo não) e **Sem
nota** (cinza, nada). O âmbar é a fila de trabalho de quem confere nota fiscal.

A ordenação da coluna acompanha: o `invoiceStatus` virou um `case` que devolve 2, 1 ou 0, então
ordenar crescente agrupa primeiro o que ainda falta resolver.

**Erro de seleção de arquivo não pode morar no objeto que o `validate()` limpa.** O formulário de
entrada guardava o aviso do anexo em `invoiceErrors.attachments`, e a primeira linha do `validate()`
é `invoiceErrors.value = {}`. Resultado: escolher um arquivo acima de 10 MB mostrava o aviso, e
clicar em salvar **apagava o aviso e gravava a entrada sem o anexo**, porque a checagem de erros
passava a encontrar o objeto vazio. Hoje o aviso é um `computed` sobre a seleção atual
(`invoiceSelectionError`, em `lib/invoiceAttachments.ts`), então ele não pode ser apagado por quem
valida, e o `validate()` o inclui no retorno. A regra geral: **estado derivado da seleção vira
`computed`, não campo gravado num objeto de erros que alguém zera depois**.

O limite de 3 arquivos e de 10 MB estava escrito nas duas telas que enviam anexo, com o número solto
no meio da condição. Agora está em `lib/invoiceAttachments.ts`, junto de um comentário dizendo que o
valor espelha `INVOICE_MAX_FILE_SIZE` da API. A mensagem também mudou de "Cada arquivo pode ter até
10 MB" para o nome do arquivo e os dois tamanhos, porque com três arquivos selecionados a mensagem
antiga não dizia qual deles era o problema.

### Coluna de outra tabela em `sql` de ordenação sai com o alias errado

Ordenar as entradas pela situação da nota fiscal devolvia **500**, e nenhum teste cobria esse
`sortBy`. A causa: `db.query.stockEntries.findMany` monta a consulta com a tabela raiz apelidada
(`"stockEntries"`), e uma referência de coluna de **outra** tabela dentro de um `sql` template sai
com esse mesmo apelido. O `${stockEntryAttachments.stockEntryId}` da subconsulta virava
`"stockEntries"."stock_entry_id"`, coluna que não existe, e o Postgres recusava a consulta inteira.

Numa relational query, dentro de `sql` só entram colunas da tabela raiz pelo schema. A subconsulta
correlacionada é escrita à mão, com apelido próprio, e repete o `company_id` para não depender do
escopo de fora. Vale lembrar que o erro só aparece quando alguém clica naquele cabeçalho: consulta
montada com o mesmo padrão em `select` normal (sem `with`) funciona, o que faz esse tipo de defeito
passar em revisão.

### Peças compartilhadas das listagens

Toda listagem é montada com as mesmas peças, e a regra é: se a coisa aparece igual em duas telas, ela
mora num componente ou num composable, não copiada nas duas.

- **`FilterModal`** embrulha o modal de filtro inteiro (o formulário, o "Limpar" à esquerda e o par
  "Cancelar"/"Aplicar" à direita). A tela só declara os campos dentro dele. Antes esse rodapé estava
  copiado em 11 telas, com duas variações de ordem de classe que ninguém tinha notado. Os eventos
  (`apply`, `clear`, `close`) casam com o que o `useFilterModal` devolve, então a ligação é direta.
- **`useFilterModal`** é o único caminho para filtro em rascunho. O `SystemLogsView` mantinha uma
  cópia própria das três funções porque o filtro dele tem um objeto dentro (o período) e a cópia rasa
  do composable fazia rascunho e filtro aplicado compartilharem a mesma referência: mexer no rascunho
  já alterava a listagem. Agora a cópia é `structuredClone(toRaw(...))` no composable, e existe teste
  (`tests/filterModal.test.ts`) fixando as três garantias: rascunho isolado, aplicar copiando e
  limpar voltando ao padrão nos dois lados.
- **`usePagination().reload(load)`** é como se volta para a página 1. A forma antiga
  (`page.value = 1` seguido de `load()`) estava repetida em 21 lugares e fazia **duas** requisições
  quando o usuário não estava na primeira página: a explícita mais a do observador de `page`. O
  `reload` mexe na página quando ela não é 1 e deixa o observador recarregar, ou chama a carga direto
  quando já está na 1. Uma requisição em qualquer caso.
- **`usePagination().paginationProps`** entrega os quatro valores e os dois handlers da paginação de
  uma vez, usados como `<Pagination v-bind="paginationProps" />`. Além das 15 repetições do mesmo
  bloco de propriedades, isso resolveu duas telas fora do padrão: uma escutava `@change`, evento que
  o `Pagination` não emite (era código morto, quem recarregava era o observador de `page`), e outra
  não tinha handler nenhum.
- **`SortableTableHeader`** desenha o cabeçalho ordenável. O `uppercase` estava na classe do `th`,
  onde não tinha efeito: o texto vive dentro de um `<button>`, e o preflight do Tailwind zera o
  `text-transform` de todo botão para normalizar Firefox e Edge. O resultado era cabeçalho ordenável
  em caixa normal ao lado de cabeçalho fixo em maiúsculas, na mesma tabela, em todas as telas. A
  classe passou para o botão. Herança de `text-transform` não vence um reset que mira o elemento.
- **`ItemsSummary`** mostra a relação de itens de um lançamento como contagem (`12 itens`) e abre a
  tabela num modal. A primeira versão abria a lista dentro da própria célula, como o
  `ExpandableText` faz: resolvia a largura, mas esticava a linha na vertical e empurrava as
  seguintes para baixo. No modal cabe a tabela com quantidade e unidade alinhadas, que é o formato
  em que essa informação é lida. Dentro dele o nome do produto **quebra** em vez de truncar: são
  duas colunas e sobra altura, e a prévia com chevron do `ExpandableText` espremia a coluna de
  quantidade para fora da tela no celular. O papel não tem clique, então a lista completa é
  renderizada oculta e só aparece na impressão, no lugar do botão.
- **`StatusBadge`** e `lib/status.ts` guardam as palavras e a cor de ativo/inativo. A etiqueta, a
  opção do filtro e a coluna do CSV saem do mesmo lugar, com o gênero como parâmetro (unidade é
  "Inativa", produto é "Inativo") e um texto alternativo para o caso de Empresas, onde inativo se
  chama "Suspenso".

Vale a contrapartida: a ligação de propriedades de um componente compartilhado **não** é duplicação a
ser eliminada a qualquer custo. O que foi extraído tinha decisão dentro (texto, cor, ordem dos botões,
quantas requisições disparar). Onde só há fiação, ela ficou explícita na tela.

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

## Limites de tamanho dos campos

Nenhuma coluna de texto do banco é `varchar`: são todas `text`, sem limite. Enquanto a validação
também não tinha limite, um operador conseguia colar um texto de megabytes numa observação de perda
ou num nome de produto, e a listagem inteira nascia deformada. Foi o que apareceu em teste, com uma
observação repetida centenas de vezes empurrando as colunas para fora da tela.

Os números moram em `shared/schemas/limits.ts` (`LIMITES_TEXTO`, `LIMITES_NUMERO`), com espelho em
`apps/web/src/lib/limits.ts`. **Mudou um, muda nos dois**, e o que vale é sempre o do backend: o
`maxlength` do campo existe só para a digitação parar antes de ir ao servidor, não como validação.
Pedir boa vontade não bastava, então `apps/web/tests/limits.test.ts` importa os dois arquivos e
falha quando um limite muda de um lado só, quando um limite novo da API não chega ao espelho, ou
quando um teto numérico deixa de caber na precisão da coluna.

O teto numérico não é preciosismo. Quantidade e saldo são `numeric(12,3)`, dinheiro é `numeric(12,2)`:
antes de existir `.max()`, uma quantidade com trinta dígitos passava pelo `.positive()` do Zod, chegava
ao `insert` e o Postgres respondia `numeric field overflow`, que o `errorHandler` só sabe traduzir
como **erro interno do servidor**. O usuário via "erro 500" onde a resposta certa era "esse valor é
grande demais". Nos campos decimais da tela, o `BaseInput` recebe `:max` e simplesmente ignora o dígito
que ultrapassa, do mesmo jeito que a máscara de CNPJ ignora o 15º.

Senha tem um limite próprio e um motivo próprio: o **bcrypt ignora tudo depois do 72º byte**. Sem teto,
duas senhas diferentes que compartilhassem os primeiros 72 bytes autenticariam o mesmo usuário.
`shared/schemas/password.schema.ts` mede em bytes, não em caracteres, porque um acento ocupa dois. A
única exceção é o campo de senha do **login**, que aceita mais: recusar ali transformaria uma senha
antiga e correta em "dados inválidos".

A importação por planilha valida os mesmos limites linha a linha, com a mensagem apontando a coluna:
ela não passa pelos schemas de cadastro, e sem isso a planilha seria o caminho aberto para gravar o que
o formulário recusa.

## Data do fato e data do lançamento

Entrada de mercadoria e perda aceitam **data retroativa**, informada pelo usuário e preenchida com hoje por padrão. A
decisão que essa funcionalidade forçou não foi o campo na tela: foi separar **quando o fato aconteceu** de **quando
alguém digitou**.

`stock_entries.entryDate` e `losses.lossDate` sempre existiram, mas `stock_movements` só tinha `createdAt`, e era por
`createdAt` que o histórico de movimentações e o dashboard filtravam o período. Enquanto ninguém podia informar data, as
duas coincidiam sempre e ninguém percebia que eram conceitos diferentes. Bastava permitir a data retroativa para as
telas divergirem em silêncio: a mesma entrada apareceria em dois dias distintos dependendo de qual tela se olhasse. Por
isso a migration `0005` acrescentou `stock_movements.movement_date`, e todas as consultas de período passaram a usá-la —
`createdAt` sobrou como trilha de auditoria e critério de desempate na ordenação.

A validação vive num só lugar (`shared/schemas/eventDate.schema.ts`) e é compartilhada pelos dois módulos, porque a
regra é a mesma e duplicá-la em dois schemas Zod seria repetir a política de datas do sistema em dois arquivos. Ela
recusa data futura, recusa data impossível em vez de normalizá-la e limita a retroatividade a `MAX_BACKDATE_DAYS`. O
`DateInput` ganhou `min`/`max` opcionais para o calendário nem oferecer os dias fora da faixa — mas a checagem da API é
que vale, a da tela só evita a ida ao servidor.

Só entrada e perda têm data informada. Ajuste de estoque, estorno de perda e carga por planilha não têm, e o motivo é o
mesmo nos três: o fato **é** o lançamento. Ajustar estoque é o resultado de uma contagem feita agora; estornar uma perda
antiga é uma decisão de hoje, não um evento do passado.

## Isolamento entre empresas, em duas camadas

A primeira camada é da aplicação, pelo `eq(tabela.companyId, …)` descrito no começo deste documento —
é ela que produz a resposta certa. A segunda é **RLS** (segurança em nível de linha) no PostgreSQL,
com política em 13 tabelas: ela não ajuda a acertar, ela existe para o dia em que a primeira errar.
Ver "Políticas de RLS por empresa" adiante.

### O verificador estático

`npm run check:tenant-scope` (`scripts/check-tenant-scope.mjs`) lê o código da API com o AST do
TypeScript e acusa consulta a tabela multiempresa que rode numa função que **nunca menciona
`companyId`**. Roda no CI e falha o build. A lista de tabelas sai do próprio schema — tabela nova com
`companyId` entra na varredura sozinha, sem ninguém precisar lembrar.

A regra é essa, e não algo mais forte, por medida deliberada:

- **Olhar só o argumento do `.where()` não serve.** Quase toda listagem monta a condição antes
  (`const where = and(...conditions)`) ou delega a um helper (`buildLossesConditions`), então o
  verificador acusaria praticamente todas as consultas corretas — e ferramenta que grita demais é
  desligada na primeira semana.
- **Exigir o texto `<tabela>.companyId` também não serve**, pela mesma razão: quebra em quem delega a
  montagem da condição a outro arquivo.
- A regra escolhida se apoia na convenção deste projeto: `companyId` é o primeiro argumento de toda
  função de serviço. Se a função nem recebeu nem usou `companyId`, ela não pensou em empresa.

**O que ele não pega:** função que recebe `companyId` e escreve o filtro errado (com a variável
trocada, por exemplo). Ele cobre o esquecimento honesto; não é prova de isolamento. É exatamente esse
buraco — filtro escrito errado — que as políticas de RLS fecham.

Ele continua valendo depois do RLS por um motivo prático: o erro que o banco produz é **consulta
vazia**, sintoma que se confunde com "não tem dado cadastrado". O verificador aponta o esquecimento no
CI, com arquivo e função, antes de virar chamado de cliente.

Na primeira execução ele encontrou uma coisa real: `countAttachments` (`invoice-storage.ts`) contava
anexos por entrada sem filtrar empresa, apoiado em a rota ter validado a entrada antes. Passou a
filtrar — a tabela guarda `companyId` justamente para não depender do chamador.

As três supressões declaradas no script são as travessias que ele acusaria: `/logs/technical`
(cobranças e logs da plataforma), o login (procura por e-mail antes de existir sessão) e a limpeza de
anexos órfãos (manutenção transversal por definição). Outras travessias legítimas — `isPlatformCompany`
localizando a empresa Plataforma pelo `super_admin`, a gestão de usuários da plataforma, a validação de
sessão — passam sozinhas porque mencionam `companyId` por outro motivo, e por isso não aparecem lá.

### Dois papéis de banco: por que RLS não é ligar uma chave

`POSTGRES_USER` é criado pela imagem oficial do PostgreSQL como **superusuário**, e superusuário
**ignora RLS inteiramente** — `FORCE ROW LEVEL SECURITY` também não alcança superusuário. Ligar
políticas com uma conexão de superusuário produziria um relatório de conformidade bonito e zero
consultas barradas, sem nenhum sinal de erro.

Por isso a separação de papéis veio **antes** de qualquer política, em entrega própria:

| | papel | quem usa | por quê |
|---|---|---|---|
| `DATABASE_URL` | dono (`POSTGRES_USER`, superusuário) | `migrate`, `backup` | DDL, `CREATE ROLE` e `pg_dump` |
| `APP_DATABASE_URL` | `hortierp_app` | `api`, `retention` | só `SELECT/INSERT/UPDATE/DELETE` |

O papel de aplicação é criado e mantido por `ensureAppRole` (`src/db/appRole.ts`), chamado ao final do
`migrate` — **depois** das migrations, para que os `GRANT` alcancem as tabelas que acabaram de nascer.
Três decisões dentro dele:

- **Reaplica os atributos e a senha a cada deploy.** O ambiente é a fonte da verdade, e
  `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION` no `ALTER ROLE` desfaz uma concessão
  manual que alguém tenha feito no meio do caminho para "resolver" um erro de permissão.
- **`ALTER DEFAULT PRIVILEGES`**, e não só `GRANT ON ALL TABLES`. Sem isso a tabela criada pela próxima
  migration nasceria inacessível para a API, e o erro apareceria em produção.
- **Sai sem fazer nada se o papel for igual ao dono.** Num ambiente onde `APP_DATABASE_URL` caiu no
  fallback para `DATABASE_URL`, o script tiraria o superusuário do próprio dono do banco. É aviso e
  não erro para o `db:migrate` local seguir funcionando sem a variável; em produção o `env.ts` já
  recusa subir nessa situação, então esse caminho nunca é alcançado lá.

Em produção o `env.ts` **recusa subir** sem `APP_DATABASE_URL`, e recusa também quando ela usa o mesmo
usuário de `DATABASE_URL` — o caso em que tudo parece configurado e a API segue como superusuário.

#### O backup não pode migrar para o papel restrito

`pg_dump` rodando com papel sujeito a RLS traz **só as linhas que as políticas deixam ver, e termina
com código zero**: backup verde, dados faltando. O serviço `backup` se conecta por `PGUSER`/`PGPASSWORD`
próprios, sem herdar o ambiente da API, e isso parece duplicação — não é. Está comentado no
`docker-compose.production.yml` para não ser "arrumado".

#### TRUNCATE ficou fora dos privilégios

A limpeza entre testes usava `TRUNCATE`, que exige privilégio próprio. Em vez de concedê-lo, a limpeza
passou a rodar pelo papel dono (`truncateAsOwner`, em `tests/helpers.ts`): a aplicação nunca esvazia
tabela, então esse privilégio não tem por que existir em produção.

#### Como isso é provado

A suíte de integração inteira conecta pelo papel restrito — são os 138 testes existentes que provam
que os privilégios bastam para toda a superfície da aplicação. Além deles, `tests/rls.test.ts` cria
uma tabela descartável e verifica o que a etapa em si precisava demonstrar:

- o papel não tem `rolsuper`, `rolbypassrls` nem `rolcreaterole`;
- ele alcança tabela criada depois dele, sem `GRANT` manual (prova o `ALTER DEFAULT PRIVILEGES`);
- com uma política `USING (false)`, ele para de ver a linha **e o dono continua vendo** — a
  demonstração direta de por que a API precisava sair do papel dono;
- ele não cria tabela e não trunca.

As políticas vieram na entrega seguinte, com esta no ar antes: a troca de papel é a parte que pode
quebrar acesso em produção, e misturar as duas deixaria sem saber qual delas quebrou.

## Políticas de RLS por empresa

### Como a empresa chega ao banco

A política precisa saber de qual empresa é a consulta, e essa informação vive numa **variável de
sessão do PostgreSQL** (`app.empresa`), que mora na conexão. Antes, a API pegava uma conexão do pool
por consulta e devolvia logo — a variável não sobreviveria.

Então cada requisição passa a **reservar uma conexão do início ao fim**:

1. `registerRequestScope` (`db/requestScope.ts`), no `onRequest`, tira uma conexão do pool e guarda o
   escopo num `AsyncLocalStorage`. A conexão nasce **sem empresa**.
2. `db` (`db/client.ts`) é um `Proxy`: cada uso resolve para a conexão do escopo atual, ou para o pool
   quando não há escopo. Os 30 arquivos que usam `db` não mudaram.
3. No fim do `authenticate`, `usarEmpresa` grava a empresa da sessão na conexão. É o **único** ponto
   onde isso acontece.
4. No `onResponse`, `RESET ALL` e a conexão volta para o pool.

O `onResponse` que devolve a conexão é registrado **depois** do hook de log de requisições, porque
hooks `onResponse` correm na ordem de registro e o log escreve no banco. Há também `onRequestAbort`:
requisição abortada pelo cliente não passa pelo `onResponse`, e sem isso a conexão ficaria presa.

A alternativa considerada foi passar a conexão como argumento em toda função de serviço. Mais explícito
e sem máquina escondida, mas mexeria nas 118 consultas de 30 arquivos — diff grande em código que já
está em produção, com uma chance de regressão por consulta.

### O padrão negar-por-omissão

Duas funções no banco carregam a decisão:

```sql
app_empresa_atual()  -- NULLIF(current_setting('app.empresa', true), '')::uuid
app_plataforma()     -- current_setting('app.plataforma', true) = 'on'
```

E a política, igual nas 13 tabelas:

```sql
USING      (app_plataforma() OR company_id = app_empresa_atual())
WITH CHECK (app_plataforma() OR company_id = app_empresa_atual())
```

`current_setting(…, true)` devolve NULL quando a variável nunca foi definida, e comparação com NULL
nunca casa. **Código que rode sem abrir escopo vê zero linhas**, e não os dados de todas as empresas.
Essa direção foi escolhida de propósito: o modo de falhar é resultado vazio, que aparece na tela, e
não vazamento, que não aparece.

Duas tabelas fogem do formato. `companies` compara pelo próprio `id`. `stock_entry_items` não tem
coluna de empresa: a política usa `EXISTS` sobre a entrada, que é o único caminho até o item.

### As travessias legítimas ficam declaradas

Algumas operações atravessam empresas por natureza. Cada uma liga `app.plataforma` num lugar
específico, e o lugar foi escolhido para a travessia ficar visível:

| travessia | onde | por quê |
|---|---|---|
| Login | `authenticateUser` | o e-mail é único global e ainda não existe sessão |
| Validação de sessão | `authenticate` | durante impersonação a sessão é de uma empresa e o usuário é de outra |
| Ler a própria conta | `getUserProfile`, `changeOwnPassword`, `exportOwnPersonalData` | mesma razão: a conta de quem está logado mora em outra empresa durante a impersonação |
| Cobranças e cadastro de empresas | `preHandler` das rotas | módulos inteiros `requireRole('super_admin')`, então a travessia mora ao lado da autorização |
| Log de requisição | `logs.hook.ts` | requisição sem sessão grava com empresa nula |
| Retenção | as três funções de `retention.service.ts` | o corte é por data e alcança todas as empresas |
| Apagar empresa | `erase-company.service.ts` | é ato de fora da empresa; sob escopo dela nem daria para encontrá-la |
| Seeds e limpeza de anexos | chamada do `run()` | rodam antes de existir sessão, ou varrem o disco de todas |

Nos serviços, a travessia fica **no serviço e não no chamador** — script e teste não precisam lembrar.
Nas rotas de plataforma, fica na rota, junto do `requireRole`.

### Três erros que apareceram na construção

**Escopo aninhado desligava o de fora.** `comEscopoDePlataforma` gravava `off` ao sair, em vez de
restaurar o valor anterior. Duas chamadas aninhadas — que acontece de verdade, `createTenant`
chamando `createUser` — deixavam a de fora sem travessia no meio do caminho.

**Abrir escopo definia só metade dele.** A função gravava a empresa e não tocava em `app.plataforma`.
Como a conexão vem do pool, ela podia trazer a travessia ligada de um uso anterior — e um `INSERT` em
outra empresa passou. Hoje as duas variáveis são definidas na mesma chamada, sempre. Foi o teste de
gravação cruzada que pegou.

**Ler a própria conta ficou de fora da lista de travessias.** Os 147 testes passaram e o deploy subiu; o
erro apareceu no uso real, ao **sair do modo suporte**: a conexão estava estreitada para a empresa
visitada e a conta do super admin, que mora na Plataforma, ficou invisível — a tela dizia que o acesso
havia sido encerrado. `/auth/me` tinha o mesmo defeito, latente: um F5 durante a impersonação
derrubaria a sessão. A suíte não pegou porque havia teste de **entrada** em impersonação e nenhum de
**saída**. Hoje há, e foi conferido nos dois estados: reprova sem a correção, passa com ela.

### Como isso é provado

`tests/rls-politicas.test.ts`, cinco casos:

- **consulta sem filtro de empresa** devolve só a própria — é o caso que o verificador estático não
  pega, e o que motivou tudo isto;
- **sem escopo nenhum** a consulta volta vazia;
- **gravar em outra empresa** é recusado pelo banco;
- **`UPDATE` apontando direto para o id do vizinho** alcança zero linhas;
- **item de entrada** de outra empresa não aparece, sem ter coluna de empresa;
- **seis requisições simultâneas de duas empresas** intercaladas — nenhuma vê o produto da outra. Este
  é o que guarda a máquina do escopo: se a devolução ao pool deixasse a empresa marcada, ou se duas
  requisições dividissem conexão, ele reprova.

O erro do banco chega embrulhado pelo Drizzle (`Failed query: …`, com o texto do RLS em `cause`), então
o teste compara a cadeia inteira. Comparar só a mensagem de fora daria teste que passa sem provar nada.

### O custo medido

Com `DATABASE_POOL_MAX=20`, requisições autenticadas de listagem:

| simultâneas | p50 | p95 |
|---|---|---|
| 10 | 24 ms | 37 ms |
| 20 | 28 ms | 50 ms |
| 40 | 80 ms | 93 ms |
| 80 | 64 ms | 97 ms |

O limite de aprovação do teste de carga para leitura é **p95 de 750 ms**, então sobra folga. O pool
agora dimensiona **requisições simultâneas**, não consultas: se um dia faltar conexão, o sintoma é
espera na entrada da requisição, e o ajuste é `DATABASE_POOL_MAX`.

### O que o RLS não cobre

Ele fecha uma classe de erro, não todas. Continuam fora do alcance: erro na lógica de impersonação
(`realCompanyId`), bug que grave a empresa errada na conexão, e as travessias declaradas acima — que
por serem escopo de plataforma enxergam tudo, por construção.

## Planilha exportada não pode virar fórmula

Excel e LibreOffice avaliam como fórmula toda célula iniciada por `=`, `+`, `-`, `@`, tabulação ou
retorno de carro. As planilhas do sistema carregam texto digitado pelo usuário — nome de produto,
observação, motivo — então um produto chamado `=HYPERLINK("http://…"&A1;"clique")` viraria fórmula
viva. O detalhe que torna isso relevante e não teórico: **quem digita pode ser um operador e quem
exporta é normalmente o administrador**, então o efeito acontece na máquina de quem tem mais acesso.

`protectFromFormula` (`lib/csv.ts`) prefixa a célula com apóstrofo, que a planilha entende como "isto
é texto" e não exibe. Duas sutilezas:

- **Número negativo é exceção.** `-2,000` dispara o mesmo `-` sem ser ameaça, e prefixá-lo
  transformaria quantidade em texto: a planilha pararia de somar a coluna. `NUMERIC_CELL` reconhece o
  formato brasileiro (inclusive milhar) e passa direto.
- **A proteção é simétrica.** A exportação de Produtos reimporta pela tela de importação
  (`normalizeHeader` ignora acentos e caixa, e `situacao` é alias de `ativo`), então `parseCsv` remove
  o apóstrofo na leitura — só quando o caractere seguinte é um dos gatilhos, para não estragar um nome
  que legitimamente comece com apóstrofo. Sem isso, exportar e reimportar renomearia o produto.

## CSP sem `unsafe-inline`: o hash do script do tema

A CSP de produção (`deploy/caddy/Caddyfile`, repetida em `deploy/nginx.conf`) autoriza scripts por **hash**,
não por `'unsafe-inline'`. A diferença importa porque `'unsafe-inline'` anula a CSP como rede de
proteção: com ela, qualquer script injetado executaria.

Existe **um** script inline em `apps/web/index.html`, o que aplica o tema antes da primeira pintura.
Ele é inline por necessidade: num arquivo externo chegaria depois do primeiro quadro e o modo escuro
piscaria branco. Por isso a CSP traz o `sha256-…` dele em vez da permissão geral.

Isso cria um acoplamento entre um HTML e dois arquivos de configuração, e a falha é **silenciosa** —
hash divergente bloqueia o script, o tema passa a ser aplicado só depois que o Vue monta, e volta o
piscado. `npm run csp:hash` confere os dois arquivos (com `-- --write` corrige), roda no CI e falha o
build quando divergem.

Os cabeçalhos estão duplicados no nginx de propósito: em produção o Caddy na frente os injeta, mas
quem alcançar a porta 8080 direto receberia a aplicação sem proteção nenhuma. `add_header` dentro de
um `location` **descarta** os herdados do `server`, por isso eles reaparecem no `location /`.

`style-src` mantém `'unsafe-inline'`: o `index.html` tem um bloco `<style>` grande para a tela de
carregamento e o Vue aplica estilo dinâmico em componente. Aqui o ganho seria pequeno e a quebra,
visível.

## Mensagens de erro sempre em português

Duas regras de escrita valem para todo texto de tela, não só para erro: **sem travessão** (`—`) e sem
palavra em inglês. O travessão saiu de aviso, rótulo de filtro, título de modal e do aviso de
privacidade; onde ele separava uma explicação, virou ponto, dois-pontos ou parêntese. Onde só juntava
dois dados (empresa e competência, rota e status), o separador é o ponto médio `·`, que já era o padrão
das listagens.

Toda mensagem que chega ao cliente é em português, e o caminho vazava por dois lados.

O primeiro é o Zod. O `errorHandler` devolve `error.flatten().fieldErrors` direto para a tela, campo a campo, então **qualquer regra escrita sem mensagem própria vira inglês**: `.max(10)` numa abreviação de unidade aparecia como `String must contain at most 10 character(s)` embaixo do campo. Escrever a mensagem em cada regra resolve só enquanto ninguém esquecer. O que resolve de fato é `shared/schemas/zodErrorMap.ts`, um `z.setErrorMap` global registrado antes de qualquer schema ser usado (o `import` com efeito colateral no topo de `app.ts`): ele traduz `too_small`, `too_big`, `invalid_type`, `invalid_enum_value` e companhia, e a mensagem específica de cada schema continua tendo prioridade quando existe. Assim uma validação nova nasce em português mesmo sem ninguém lembrar de escrever o texto.

O segundo são os **erros do Fastify e dos seus plugins, que nascem em inglês**, e o `errorHandler` repassava `error.message` sem olhar em qualquer 4xx que não fosse `AppError`. Foi assim que `Rate limit exceeded, retry in 53 seconds` apareceu na tela do usuário.

A tradução mora em `shared/errors/frameworkMessages.ts`, e `frameworkErrorMessage` resolve em duas camadas: primeiro pelo código do erro (`FST_REQ_FILE_TOO_LARGE`, `FST_ERR_CTP_INVALID_MEDIA_TYPE`, …), e, sem código conhecido, pela mensagem genérica do status HTTP. A função **nunca devolve `undefined`** — é o que garante que um plugin novo, com códigos que ninguém mapeou, degrade para um texto genérico em português em vez de voltar a vazar inglês.

O texto original em inglês não é jogado fora: o `errorHandler` mantém a mensagem crua em `request.technicalError`, que é o que vai para `system_logs`. O usuário lê português, o operador continua com o texto do framework para depurar.

Dois erros precisaram de tratamento na origem, e não no `errorHandler`:

- **Excesso de requisições:** o `errorResponseBuilder` do `@fastify/rate-limit` levanta um `AppError`, para a resposta sair no mesmo envelope de todo o resto. O tempo de espera é calculado a partir de `context.ttl` (milissegundos), **não** do campo `context.after` do plugin — que já vem formatado em inglês (`"53 seconds"`) e daria uma tradução por interpretação de texto.
- **Endereço inexistente:** o 404 padrão do Fastify não passa pelo `errorHandler` e usa outro formato de corpo (`{ message, error, statusCode }`), então o frontend nem achava a mensagem e caía no texto genérico. Um `setNotFoundHandler` levanta `AppError.notFound`, unificando idioma e envelope.

O anexo grande demais é um caso à parte e vale registrar, porque a documentação do `@fastify/multipart` engana: com `throwFileSizeLimit` ligado (o padrão), o erro `FST_REQ_FILE_TOO_LARGE` só é levantado por `toBuffer()` ou pelo iterador de partes. Quem consome `file.file` por conta própria — é o que `invoice-storage.ts` faz, gravando direto em disco com `pipeline` para não carregar 10 MB na memória — recebe um stream que **termina normalmente**, apenas com `truncated` marcado. Sem a checagem explícita de `file.file.truncated`, o upload responderia `201` com o arquivo cortado. A frase com o limite em MB mora em `fileTooLargeMessage`, junto do mapa de traduções, e é usada tanto por essa checagem quanto pelo código do framework — para os dois caminhos nunca divergirem.

### Erro de formulário aparece como alerta, não no rodapé da página

Cada tela tinha um `<p>` de erro acima da tabela, e o erro de um formulário em modal caía nele: a
mensagem renderizava **atrás do modal aberto**, invisível para quem acabou de clicar em salvar. Foi
assim que `Quantidade solicitada (51) maior que o estoque disponível (50)` não chegou ao usuário.

A divisão hoje é pela origem do erro:

- **erro de campo** (`fieldErrors`) continua no próprio campo, em vermelho;
- **erro geral de submit** vai para `toastError`, que o SweetAlert2 desenha em `z-index: 1060`, acima
  do modal (`z-40`);
- **erro ao carregar a página** — a lista que não veio, o filtro que falhou — continua no `<p>`, que é
  onde ele deve estar: não há modal na frente, e a mensagem precisa ficar na tela.

O critério prático no código: `resolveFormError` é submit, `getApiErrorMessage` num carregamento é
página.

### Quantidade precisa ser formatada, em mensagem e em tela

`numeric(_, 3)` chega da consulta como string: um saldo de 50 vira `"50.000"`, que em português se lê
como cinquenta mil — a mensagem dizia que 51 era maior que "50.000". `formatQuantity`
(`shared/utils/quantity.ts`) resolve com `toLocaleString('pt-BR')`, e é por onde toda quantidade em
mensagem de erro deve passar.

O mesmo valia para a tela, por outro caminho: dezesseis lugares renderizavam `{{ Number(quantidade) }}`,
e `Number(38.5).toString()` devolve `"38.5"`, com ponto decimal de outro idioma. Todos passam agora pelo
`formatQuantity` do front (`lib/format.ts`), gêmeo do da API. Quantidade que aparece ao usuário não sai
de `Number()` cru.

### Campo com máscara precisa reescrever o campo quando o modelo não muda

CNPJ, telefone e CEP são campos controlados: o `input` mostra o valor do modelo já mascarado, e cada
tecla passa por `formatInputMask`. O problema é que o Vue só reescreve o DOM quando o valor do modelo
**muda** — e digitar uma letra, ou um dígito além do limite da máscara, devolve exatamente o mesmo
valor formatado. Modelo igual, nenhuma re-renderização, e o caractere recusado fica visível no campo.
Na tela, isso é indistinguível de "a máscara sumiu": aparece `96.946.510/0001-259` num campo que
supostamente não aceita aquilo.

`BaseInput` agora compara o que está no elemento com o que deveria estar e reescreve o elemento quando
diferem, além de emitir o valor. Vale para o caminho mascarado e para o de casas decimais, que tinha
o mesmo furo.

### CNPJ alfanumérico: o dígito verificador conta letra pelo código ASCII

A IN RFB 2.229/2024 criou o CNPJ alfanumérico, que vale para inscrições novas a partir de julho de
2026: as **12 primeiras posições** aceitam letra maiúscula ou dígito, e os **dois dígitos
verificadores continuam numéricos**. O exemplo oficial da Receita é `12.ABC.345/01DE-35`.

O sistema recusava esse CNPJ em quatro pontos, e todos precisavam mudar juntos:

1. **Normalização** apagava letra. Era `replace(/\D/g, '')` nas duas pontas, então `12.ABC.345/01DE-35`
   chegava ao validador como nove dígitos. Hoje é `replace(/[^0-9A-Za-z]/g, '').toUpperCase()`, com a
   mesma regra na API (`companies.schema.ts`) e no front (`normalizeCnpj`, em `lib/format.ts`).
2. **Dígito verificador.** O módulo 11 continua com os mesmos pesos; o que muda é o valor de cada
   posição, que passa a ser o **código ASCII menos 48**. Isso faz `'0'` a `'9'` valerem 0 a 9, ou
   seja, **o cálculo dos CNPJ só de dígitos que já estão no banco não muda em nada**. É por isso que
   não existe migration nem revalidação de dado antigo nesta mudança: uma função serve aos dois
   formatos. `'A'` vale 17, `'Z'` vale 42.
3. **Máscara.** As 12 primeiras posições passam a aceitar letra; as duas últimas continuam só
   número, então letra digitada ali é descartada em vez de empurrar o dígito verificador para fora.
4. **Comprimento no front.** A tela de empresas checava `onlyDigits(document).length !== 14`, o que
   barrava o CNPJ com letra antes de a requisição sair. Passou a usar `normalizeCnpj`.

Uma armadilha de mobile veio junto: campo com máscara recebia `inputmode="numeric"`, e no celular isso
abre o teclado **de números**, sem letra. Quem fosse cadastrar um CNPJ alfanumérico pelo telefone não
tinha como digitar. O `inputmode` numérico agora vale para telefone, CEP e casas decimais, e não para
o CNPJ.

O que **não** mudou: a coluna `document` já era `text`, e CPF (a máscara `cpf` do `BaseInput`) continua
só numérico, porque a mudança da Receita é do CNPJ.

### Campo obrigatório: asterisco na etiqueta, validação em JavaScript

O `required` de `BaseInput`, `BaseSelect`, `DateInput` e `MonthInput` **não chega ao elemento nativo**.
Ele vira o asterisco vermelho ao lado da etiqueta (`FieldLabel`, um componente só para isso, porque a
etiqueta estava duplicada nos quatro) e um `aria-required` para leitor de tela. Quem valida é o
`validate()` de cada tela, que escreve em `fieldErrors` e mostra a mensagem em vermelho sob o campo.

O motivo de não usar o `required` do navegador: ele barra o submit antes do JavaScript e mostra a
bolha dele, que não é o padrão de erro do sistema; num modal com abas o campo vazio pode estar numa
aba escondida, e aí o formulário simplesmente não envia sem ninguém entender por quê; e o efeito
dependia de o `<form>` ter ou não `novalidate` — metade das telas tinha, metade não. Duas telas
dependiam do `required` nativo para barrar campo vazio (`Meu perfil` e o estoque mínimo em Produtos);
as duas ganharam a checagem em JavaScript na mesma mudança.

A consequência prática é uma regra: **`required` é uma afirmação sobre a etiqueta, não sobre a
validação**. Se o `validate()` da tela não cobre o campo, o asterisco está mentindo.

### Um jeito só de escolher numa lista

O `BaseSelect` tinha dois modos: o normal (botão com a seta que gira, lista flutuante e campo de
busca) e um modo `searchable: false` que caía num `<select>` nativo. O segundo modo era usado nos
filtros de Categorias, Unidades, Logs de atividades e Cobranças, e nos seletores de mês e ano do
`MonthInput`. Resultado: campos com aparência e comportamento diferentes na mesma tela, e o
operador não conseguia digitar para achar a opção em uns e conseguia em outros.

O modo nativo foi removido. Toda escolha em lista no sistema é o mesmo componente, com busca. Como
o gatilho do ano tem 7rem de largura, a lista flutuante ganhou largura mínima de 224px (o campo de
busca não caberia na largura do gatilho), sempre limitada à largura da tela para não criar rolagem
horizontal no celular.

O `<select>` nativo que sobra é o "por página" da paginação: ali são três números num rodapé
compacto, não um campo de formulário.

Uma consequência de vocabulário na mesma mudança: a coluna e o filtro de ativo/inativo se chamam
**Situação** em todas as telas (era "Status" em Produtos, Usuários, Empresas e Cobranças, e
"Situação" em Categorias e Unidades), e a opção que não filtra nada se chama "Todas as situações".
Opção de "todos" com nome genérico atrapalha, porque é ela que aparece no campo fechado: o filtro
precisa dizer o que ele filtra mesmo quando ninguém escolheu nada.

### UF sai de lista fechada, não de texto livre

O campo era texto de duas letras, então `XX` passava no front e na API. Hoje o formulário usa
`BaseSelect` com as 27 UFs (`lib/ufs.ts`, encontrável pela sigla ou pelo nome do estado) e a API
valida com `ufSchema` (`shared/schemas/uf.schema.ts`), que passa para maiúsculas antes de comparar —
`sp` continua entrando como `SP`.

A lista é constante em código, e não tabela no banco. Tabela de UF pediria migration, carga inicial,
política de RLS (é tabela sem `company_id`, e o verificador de escopo cobraria uma exceção declarada)
e uma rota só para lê-la — para um cadastro que muda quando o país cria um estado. O objetivo, que é
não gravar UF inválida, vem da validação.

### Consulta de CEP: provedor fora do ar não é CEP inexistente

Três comportamentos diferentes apareciam como a mesma frase, "CEP não encontrado nos serviços
disponíveis":

- **Abrir o cadastro disparava consulta.** O modal de edição preenchia o formulário, o `watch` do CEP
  via valor novo e buscava: o endereço ajustado à mão era sobrescrito pelo do provedor e aparecia o
  aviso "Endereço preenchido pelo CEP" sem ninguém ter pedido nada. O modal agora abre marcando o CEP
  gravado como já consultado; só CEP alterado dispara busca.
- **O erro do CEP anterior ficava na tela** enquanto o CEP novo era digitado, porque só uma consulta
  bem-sucedida limpava a mensagem. Agora a primeira tecla apaga o erro.
- **Provedor fora do ar respondia como "não existe".** As três consultas em cadeia eram tentadas dentro
  de um `try` vazio, e falha de rede caía no mesmo `404` de CEP inexistente — um CEP válido aparecia
  como inválido sempre que o servidor ficava sem internet. `findAddressByCep` agora distingue
  "provedor respondeu que não achou" de "nenhum provedor respondeu", e o segundo caso é `503` com
  "Não foi possível consultar o CEP agora. Preencha o endereço à mão."

### Confirmação de senha onde alguém digita a senha de outra pessoa

Nova empresa (senha do administrador), Novo usuário e Novo super administrador: quem digita não é quem
vai usar, o campo é mascarado, e um erro de digitação só aparece do outro lado, na forma de alguém que
não consegue entrar. Os três têm **Confirmar senha**, validada no `validate()` da tela. O botão de
gerar senha aleatória preenche os dois campos — senão a comodidade brigaria com a confirmação.

## Logs técnicos e auditoria por empresa

Um hook global `onResponse` registra em `system_logs` as requisições da API, sem persistir corpo, senha, cookie ou token. Respostas 2xx/3xx são `info`, 4xx são `warning` e 5xx são `error`; o tratamento centralizado de erros anexa código e mensagem ao contexto antes da persistência.

- `GET /logs/technical`: exclusivo de `super_admin`, permite consultar todas as empresas e expõe contexto técnico (rota, status, duração, IP, navegador e erro).
- `GET /logs/activity`: exclusivo de `admin`, força o `companyId` da sessão no backend e retorna somente operações de escrita da própria empresa. Campos técnicos sensíveis são removidos da resposta.
- As próprias rotas de consulta de logs não geram novos registros, evitando ruído e crescimento recursivo.
- **Healthcheck também não gera registro.** Os caminhos ficam em `shared/config/health.ts` (`HEALTH_PATHS`), lista consumida tanto por quem registra as rotas (`app.ts`) quanto por quem as ignora no hook (`logs.hook.ts`). Quando `/api/health` nasceu, o hook continuou ignorando apenas `/health` e um monitor externo batendo de minuto em minuto passou a gravar cerca de 43 mil linhas por mês em `system_logs` — a lista compartilhada existe para que acrescentar um caminho de saúde não dependa de lembrar do segundo arquivo.

As ações registradas em `activity_logs` são `criou`, `alterou`, `excluiu`, `importou`, `ajustou` e `cancelou`. A coluna é `text` livre no banco, mas o conjunto é fechado em três lugares que precisam andar juntos: o tipo `ActivityAction` (backend), o `activityActionSchema` do filtro e os mapas de rótulo e cor da tela de auditoria (`ActivityLogsView.vue`) — o `vue-tsc` acusa se algum ficar para trás, porque os mapas são `Record<ActivityAction, …>`.

`system_logs` e `activity_logs` são as tabelas que mais crescem e dominam o tamanho do backup. A limpeza é automática, semanal, com prazos vindos de duas leis que empurram em sentidos opostos — ver "Retenção de dados pessoais" em [deploy-producao.md](./deploy-producao.md).

### "Informações adicionais" do log não é JSON na tela

O campo `details` de `activity_logs` é um objeto livre, e a tela imprimia o `JSON.stringify` dele:
`{"motivo":"roubo_furto","quantidadeEstornada":"50.000"}`. `describeActivityDetails`
(`lib/activityDetails.ts`) traduz a chave, traduz o valor quando ele é código de perfil ou motivo de
perda, troca `true`/`false` por Sim/Não, junta lista com vírgula e passa quantidade `numeric` pelo
`toLocaleString('pt-BR')` — pelo mesmo motivo da seção da quantidade acima, "50.000" não pode ser lido
como cinquenta mil. Chave que ninguém traduziu ainda aparece legível (`comEstoqueInicial` → "Com
estoque inicial") em vez de sumir, e a exportação em planilha usa o mesmo texto.

Os dois detalhes de log (atividade e técnico) usam `DetailField` para etiqueta e valor, e o perfil de
acesso passa por `roleLabel` — antes o log técnico mostrava `super_admin` cru na tela.

## Correção de lançamentos operacionais

Entradas, perdas e movimentações são históricos: nenhuma delas oferece exclusão. Mas errar o lançamento é normal, e a resposta é a mesma nos dois fluxos que têm correção — **separar o que é descritivo do que mexe no estoque**:

- **Campos descritivos** (fornecedor, dados fiscais, motivo, observações) são editáveis por `admin`/`gerente`. Não afetam saldo nem período.
- **Produto, quantidade e data** são imutáveis. Editá-los alteraria o estoque retroativamente e moveria o registro entre períodos já conferidos, além de reabrir a mutabilidade do custo congelado em `unitCost`.

A diferença entre os dois fluxos está no que se faz quando é justamente a quantidade ou o produto que está errado:

- **Perda** tem cancelamento (`POST /losses/:id/cancel`): marca `cancelledAt`, devolve a quantidade ao estoque como `ajuste` com `referenceType: 'loss_cancellation'` e tira o registro dos relatórios. Isso é possível porque devolver estoque é incremento — nunca falha por saldo insuficiente.
- **Entrada** não tem: estornar uma entrada é decremento e poderia deixar o saldo negativo se a mercadoria já saiu. Ali a correção continua sendo o ajuste manual de estoque.

O cancelamento de perda existe porque o ajuste manual, embora conserte o **saldo**, deixa o registro da perda intacto — e portanto o "valor perdido no período" do painel e o relatório de perdas seguiriam inflados. Num sistema cujo propósito é medir desperdício, esse número errado é o dano principal, não o saldo.

## Retenção de dados pessoais: dois prazos, duas leis

O sistema guarda dado pessoal em dois lugares que crescem sem parar: `system_logs` (endereço IP e
navegador, uma linha por requisição) e `activity_logs` (nome de quem fez o quê). Até a implementação
da retenção, nenhum dos dois tinha expurgo — cresciam para sempre.

O instinto de quem lê "LGPD" é apagar o quanto antes. Está errado, e o motivo importa:

- O **Marco Civil da Internet** (art. 15) obriga provedor de aplicação com fins econômicos a
  **guardar** data, hora e IP por 6 meses. É piso legal.
- A **LGPD** (arts. 15 e 16) manda **não guardar** além do necessário. É teto.

Os dois prazos se encontram exatamente em 180 dias, que é o padrão de `TECHNICAL_LOG_RETENTION_DAYS`.
O `env.ts` **recusa subir a API** com valor menor: encurtar esse prazo não é economia de espaço, é
descumprir a lei, e um erro assim não deve depender de alguém revisar um arquivo de configuração.

Para `activity_logs` o prazo é 5 anos (`AUDIT_RETENTION_DAYS`), acompanhando a fiscalização
tributária. A justificativa é a finalidade: a trilha só serve enquanto responde "quem lançou a
movimentação deste período" — e o período deixa de ser questionável depois disso.

### Por que exclusão de usuário não apaga o nome na hora

`softDelete` marca `deletedAt` e mantém nome e e-mail. Isso parece contradizer a LGPD, e é a decisão
certa: o histórico de atividades referencia o `id` do usuário, e apagar a linha inteira transformaria
a trilha de auditoria em uma lista de identificadores sem significado, justamente no período em que
ela pode ser exigida.

A resposta é retenção com prazo, não exclusão imediata. Passados os 5 anos, `anonymizeDeletedUsers`
corta o vínculo com a pessoa: nome vira `Usuário removido`, o e-mail passa para o domínio
`anonimizado.invalid` (reservado pela RFC 2606, nunca registrável por ninguém) e o hash da senha é
substituído por um valor sem formato bcrypt — segunda tranca para o caso de alguém reativar a conta
direto no banco sem saber que ela foi anonimizada.

Um detalhe que quase passou: o nome também mora em `activity_logs.entityLabel`. Anonimizar só a linha
de `users` deixaria o nome legível na tela de histórico, e a anonimização não teria servido para nada.
A transação limpa os dois.

### Exclusão definitiva é script, não rota

`eraseCompany` apaga todas as linhas de uma empresa e os arquivos de nota fiscal — o que a LGPD exige
no fim do contrato. Deliberadamente **não existe tela nem rota HTTP**: uma rota seria um botão a um
clique de apagar o cliente errado, sem volta. Exigir acesso ao servidor e repetir o nome exato da
empresa faz o acidente ser improvável, e é operação feita uma vez por contrato, não função do dia a
dia.

Duas ordens importam ali e estão cobertas por teste:

- As chaves estrangeiras não têm `ON DELETE CASCADE`, então cada tabela filha sai antes da que ela
  referencia. `stock_entry_items` não tem `companyId` e é alcançada pela entrada a que pertence — se a
  ordem estivesse errada, sobrariam itens órfãos apontando para entradas inexistentes.
- Os arquivos do disco só são apagados **depois** do commit. Se a transação abortasse com os arquivos
  já removidos, a nota fiscal estaria perdida com o registro dela intacto. Arquivo sobrando é
  recuperável pelo `cleanupInvoiceOrphans`; arquivo apagado por engano, não.

### O verificador de escopo e as travessias de propósito

As consultas de retenção cortam por **data, não por empresa** — filtrar por `companyId` deixaria log
vencido de outra empresa para trás. Isso viola a regra do `check-tenant-scope`, e por isso as três
entram em `TRAVESSIAS_LEGITIMAS` com o motivo escrito. A regra continua valendo para todo o resto: é
mais seguro justificar cada exceção do que afrouxar a verificação.

## Direito de acesso do titular

`GET /auth/me/personal-data` devolve ao usuário o que o sistema guarda sobre ele — cadastro e as
atividades que ele mesmo registrou — atendendo aos incisos II e V do art. 18 da LGPD sem depender de
pedido ao administrador. A tela de Perfil tem o botão que baixa o arquivo.

Três decisões de escopo, todas cobertas por teste:

- **Só o próprio titular.** As atividades filtram por `actorId`; atividade de colega não entra.
- **O histórico técnico entra como resumo** (quantidade e período), não como lista de IPs. O titular
  tem direito de saber que o registro existe; o detalhamento é fornecido sob o sigilo que o Marco
  Civil (art. 10) exige, mediante pedido.
- **Teto de 5.000 atividades** por exportação, com indicação de truncamento — para a resposta não
  virar um download de dezenas de megabytes numa conta antiga.

## Montagem de arquivo único quebra em silêncio

A configuração do gateway era montada como **arquivo único** (`./deploy/Caddyfile:/etc/caddy/Caddyfile`).
Isso funcionou até o deploy passar a atualizar o arquivo, e então produziu a pior categoria de falha:
a que reporta sucesso.

A cadeia era esta. O Docker, ao montar um arquivo único, amarra o **inode** — a identidade do
arquivo no disco — e não o caminho. O `rsync` do deploy não edita no lugar: escreve um temporário e
renomeia por cima, o que **cria um inode novo**. O arquivo no servidor ficava atualizado, e o
container seguia lendo o inode antigo. O `caddy reload` então recarregava a configuração **velha**,
com êxito, e devolvia código de saída 0. Job verde, CSP antiga no ar, nada nos logs.

Medido lado a lado, com o mesmo `rsync` do deploy:

| Montagem | Host depois do rsync | Container depois do rsync |
|---|---|---|
| arquivo único | conteúdo novo | **conteúdo antigo** |
| diretório | conteúdo novo | conteúdo novo |

Daí duas mudanças. A montagem passou a ser de **diretório** (`./deploy/caddy:/etc/caddy`), porque
diretório resolve o nome a cada abertura e vê o arquivo trocado. E o `deploy.sh` ganhou uma
conferência que compara o resumo do arquivo no repositório com o que o container está lendo, e
**falha o deploy** se divergirem.

A segunda mudança é a que importa mais no longo prazo. A primeira corrige esta causa; a segunda
garante que qualquer outra causa futura apareça como deploy vermelho em vez de silêncio. A lição não
é sobre inode: é que passo de deploy sem verificação de efeito pode estar mentindo desde o primeiro
dia sem ninguém notar.
