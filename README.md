# HortiERP Lite

Sistema web modular para controle de estoque, entradas de mercadorias, notas fiscais vinculadas e perdas voltado para hortifrutis, frutarias, verdureiras, sacolões e pequenos mercados.

Multiempresa: cada empresa-cliente tem seus dados totalmente isolados (produtos, estoque, entradas, perdas, usuários). Empresas-cliente são cadastradas por um usuário `super_admin` pela tela `/empresas`, com identificação fiscal, contato, endereço e criação do primeiro administrador em uma única operação.

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
identificação do usuário responsável pelas operações e impersonação.

Com Docker disponível, execute na raiz:

```bash
npm test
```

O comando cria o container `hortierp-tests-postgres-test-1`, aplica as migrations, executa os testes e remove o
container ao terminar. A suíte recusa executar se o nome do banco em `DATABASE_URL` não contiver `test`.

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
