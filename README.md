# HortiERP Lite

Sistema web modular para controle de estoque, entradas de mercadorias, notas fiscais vinculadas e perdas voltado para hortifrutis, frutarias, verdureiras, sacolões e pequenos mercados.

Multiempresa: cada empresa-cliente tem seus dados totalmente isolados (produtos, estoque, entradas, perdas, usuários). Empresas-cliente são cadastradas por um usuário `super_admin` pela tela `/empresas`, com identificação fiscal, contato, endereço e criação do primeiro administrador em uma única operação. O `super_admin` também controla manualmente as mensalidades dos clientes pela tela `/cobrancas`, sem integração com meios de pagamento.

Ver [claude.md](./claude.md) para a visão completa do projeto.

## Stack

- **Frontend:** Vue 3, Vite, TypeScript, Tailwind CSS, Vue Router, Pinia, Axios
- **Backend:** Node.js, TypeScript, Fastify, Zod, JWT, RBAC
- **Banco de dados:** PostgreSQL, Drizzle ORM
- **Infra:** Docker, Docker Compose

## Estrutura 

```
ERP-LITE/
├── apps/
│   ├── web/     # Frontend Vue 3
│   └── api/     # Backend Fastify
├── docker/
├── docs/
└── docker-compose.yml
```

## Como rodar (desenvolvimento)

### Com Docker (recomendado)

1. Copie os arquivos de ambiente:
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
   O `.env` da raiz define usuário/senha/porta do Postgres para o Docker Compose (fonte única — troque só ali). Se você mudar esses valores, atualize também `DATABASE_URL` em `apps/api/.env` para bater com eles.
2. Suba os containers:
   ```bash
   docker compose up --build -d
   ```
3. Rode as migrations e o seed inicial (primeira vez ou após alterar o schema):
   ```bash
   docker compose exec api npm run db:migrate
   docker compose exec api npm run db:seed
   ```
   Em atualizações normais, rode somente `docker compose exec api npm run db:migrate`; não repita os seeds para
   aplicar uma migration nova.
4. Crie a empresa da plataforma e o primeiro usuário `super_admin` (uma única vez, só para conseguir cadastrar empresas-cliente pela tela `/empresas`):
   ```bash
   docker compose exec -e PLATFORM_ADMIN_EMAIL=voce@exemplo.com -e PLATFORM_ADMIN_PASSWORD=senha-forte api npm run db:seed:platform
   ```
5. Acesse:
   - Frontend: http://localhost:5173
   - API: http://localhost:3333
   - Logins de teste (criados pelo seed):
     - Admin: `admin@hortierp.com` / `admin123`
     - Gerente: `gerente@hortierp.com` / `gerente123`
     - Operador: `operador@hortierp.com` / `operador123`
   - Super admin: o e-mail/senha definidos no passo 4 (tela `/empresas`, para cadastrar novas empresas-cliente)

### Sem Docker

1. Instale as dependências na raiz do monorepo:
   ```bash
   npm install
   ```
2. Copie os arquivos de ambiente (ver acima) e ajuste `DATABASE_URL` para apontar para um Postgres local.
3. Rode as migrations e seeds:
   ```bash
   npm run db:migrate
   npm run db:seed
   PLATFORM_ADMIN_EMAIL=voce@exemplo.com PLATFORM_ADMIN_PASSWORD=senha-forte npm run db:seed:platform
   ```
4. Suba o backend e o frontend em terminais separados:
   ```bash
   npm run dev:api
   npm run dev:web
   ```

## Status

Projeto em desenvolvimento inicial (MVP). Consulte o `claude.md` para escopo e roadmap.

## Produção

O ambiente de produção usa imagens compiladas, Nginx para o frontend, Caddy para HTTPS, PostgreSQL privado, health
checks, migrations obrigatórias e backups criptografados com teste seguro de restauração. Consulte o
[guia de deploy](./docs/deploy-producao.md).

## Testes

A suíte de integração usa um PostgreSQL temporário e isolado na porta `5434`. Ela cobre isolamento multiempresa,
permissões, invalidação de sessão, concorrência de estoque, busca/paginação, integridade de dados (índices únicos),
identidade de e-mail sem depender de maiúsculas, identificação do usuário responsável pelas operações, impersonação
(incluindo a recusa da empresa Plataforma), agregações do painel, controle manual de cobranças, data retroativa de
entradas e perdas (limites e coerência entre listagem, histórico e painel), a garantia de que nenhuma mensagem de erro
chega ao cliente em inglês e o tratamento de dados pessoais: expurgo dos logs por prazo, anonimização de usuário
excluído (inclusive do nome que fica no histórico de atividades), exportação dos dados do próprio titular sem vazar
atividade de colega, e a exclusão definitiva de uma empresa sem encostar na empresa vizinha.

Com Docker disponível, execute na raiz:

```bash
npm test
```

O comando cria o container `hortierp-tests-postgres-test-1`, aplica as migrations, executa os testes e remove o
container ao terminar. A suíte recusa executar se o nome do banco em `DATABASE_URL` não contiver `test`.

Em seguida rodam os testes unitários do frontend (`apps/web/tests`, sem banco nem navegador — hoje cobrem a proteção
contra fórmula nas planilhas exportadas) e duas verificações estáticas:

- `npm run csp:hash` — confere se o hash de `script-src` na CSP ainda corresponde ao script inline de
  `apps/web/index.html`.
- `npm run check:tenant-scope` — lê o código da API com o AST do TypeScript e acusa consulta a tabela multiempresa numa
  função que não menciona `companyId`. Como o banco não tem RLS, o isolamento entre empresas depende desse filtro estar
  escrito em toda consulta; a verificação existe para o esquecimento aparecer no CI e não em produção. As poucas
  consultas transversais de propósito — login por e-mail, manutenção operacional e retenção de dados por data — estão
  declaradas com justificativa no próprio verificador. Ver
  [decisões arquiteturais](./docs/decisoes-arquiteturais.md#o-verificador-que-substitui-a-rede-de-proteção-por-enquanto).

- `npm run check:privacy-date` — o aviso de privacidade em `/privacidade` traz a data da última revisão, e essa data é
  o sinal que o leitor usa para saber se as regras mudaram. O verificador guarda um resumo **do `<template>`**, ou seja
  só do que o leitor vê, e reprova o CI se esse texto mudar sem a data acompanhar; `npm run privacy:date -- --write`
  atualiza as duas de uma vez. Mexer em comentário ou no `<script>` não dispara nada, de propósito: alarme que soa sem
  motivo ensina a ignorar o alarme. A data não é calculada em tempo de execução porque dizer "atualizado hoje" todos os
  dias afirmaria uma revisão que não houve.

Manutenção de dados pessoais (rodada por linha de comando, não pela interface):

- `npm run data:retention` — apaga log técnico e trilha de auditoria vencidos e anonimiza usuário excluído há mais que o
  prazo. Aceita `--dry-run`. Deve ser agendado por cron em produção; ver
  [deploy em produção](./docs/deploy-producao.md).
- `npm run data:erase-company` — apaga em definitivo todos os dados de uma empresa e os arquivos de nota fiscal dela.
  Irreversível: exige `--id` e `--confirm` com o nome exato, e não tem equivalente na interface de propósito.

O workflow em `.github/workflows/ci.yml` também executa os builds da API e do frontend, aplica as migrations em um
banco descartável e roda a suíte a cada push e pull request.

O teste de carga tem dois cenários: `read` (autenticado e não destrutivo, perfis de 5, 30 e 80 usuários virtuais) e
`write`, que exercita entrada de mercadoria, upload de anexo e registro de perda — os caminhos onde a concorrência
importa. O cenário de escrita **grava dados reais** e exige `ALLOW_WRITE_LOAD_TEST=true`. Consulte o
[guia do teste de carga](./tests/load/README.md) antes de executar `npm run test:load`.

## Manutenção

Um upload interrompido por queda da API pode deixar o arquivo do anexo em disco sem o registro correspondente no
banco. Nenhum fluxo normal remove esses restos, então existe um comando para isso:

```bash
npm run invoices:cleanup -- --dry-run   # lista o que seria removido
npm run invoices:cleanup                # remove
```

Só entram na varredura arquivos sem linha em `stock_entry_attachments` e com mais de 24 horas — a carência evita
apagar um upload em andamento. Vale agendar mensalmente em produção.

Antes de atualizar uma instalação existente em produção, siga o roteiro de
[atualização segura](./docs/deploy-producao.md#atualização-de-uma-instalação-existente). Ele cobre backup prévio,
migrations incrementais, volumes persistentes, smoke tests e rollback.
