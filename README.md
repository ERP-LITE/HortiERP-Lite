# HortiERP Lite

Sistema web modular para controle de estoque, entradas de mercadorias e perdas voltado para hortifrutis, frutarias, verdureiras, sacolões e pequenos mercados.

Ver [CLAUDE.md](./CLAUDE.md) para a visão completa do projeto.

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
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
2. Suba os containers:
   ```bash
   docker compose up --build -d
   ```
3. Rode as migrations e o seed inicial (primeira vez ou após alterar o schema):
   ```bash
   docker compose exec api npm run db:migrate
   docker compose exec api npm run db:seed
   ```
4. Acesse:
   - Frontend: http://localhost:5173
   - API: http://localhost:3333
   - Logins de teste (criados pelo seed):
     - Admin: `admin@hortierp.com` / `admin123`
     - Gerente: `gerente@hortierp.com` / `gerente123`
     - Operador: `operador@hortierp.com` / `operador123`

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
   ```
4. Suba o backend e o frontend em terminais separados:
   ```bash
   npm run dev:api
   npm run dev:web
   ```

## Status

Projeto em desenvolvimento inicial (MVP). Consulte o `CLAUDE.md` para escopo e roadmap.
