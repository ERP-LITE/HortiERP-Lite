# HortiERP Lite

## Visão Geral do Projeto

O HortiERP Lite é um sistema web modular para controle de estoque, entradas de mercadorias e perdas voltado para hortifrutis, frutarias, verdureiras, sacolões e pequenos mercados.

A ideia é começar com uma versão simples, funcional e vendável, focada em resolver uma dor clara: falta de controle de estoque e desperdícios/perdas de produtos.

O sistema deve ser criado do zero, com arquitetura limpa, modular e preparada para evoluir futuramente para novos módulos, como PDV, emissão fiscal, integrações com balança, leitura de XML e relatórios avançados.

Neste primeiro momento, NÃO implementar PDV fiscal, NFC-e, TEF, integração direta com balança ou emissão de cupom fiscal. Esses recursos devem ser pensados apenas como evolução futura.

---

## Objetivo da Primeira Versão

Criar um MVP funcional com:

- Login e senha;
- Controle de usuários;
- Cadastro comercial completo das empresas-cliente (razão social, CNPJ, contato e endereço);
- Permissões básicas por perfil;
- Cadastro de produtos;
- Cadastro de categorias;
- Cadastro de unidades de medida;
- Entrada de mercadorias;
- Controle de estoque;
- Registro de perdas;
- Baixa automática no estoque por perdas;
- Histórico de movimentações;
- Dashboard inicial;
- Relatórios básicos;
- Controle manual das mensalidades das empresas-cliente pelo super administrador;
- Estrutura modular para evolução futura.

---

## Stack Tecnológica

### Frontend

Utilizar:

- Vue.js 3;
- Vite;
- TypeScript;
- Tailwind CSS;
- Vue Router;
- Pinia;
- Axios ou Fetch organizado em services.

O frontend deve ser responsivo, funcionando bem em desktop, tablet e celular.

A interface deve ser simples, limpa e moderna, com foco em uso real por pequenos negócios.

---

### Backend

Utilizar:

- Node.js;
- TypeScript;
- Express, Fastify ou NestJS, escolhendo a opção mais simples e organizada para o projeto;
- API REST;
- JWT para autenticação;
- RBAC para permissões;
- Validação de dados nas rotas;
- Tratamento padronizado de erros;
- Organização modular por domínio.

---

### Banco de Dados

Utilizar:

- PostgreSQL;
- ORM ou query builder, preferencialmente Prisma ou Drizzle;
- Migrations;
- Seeds iniciais para ambiente de desenvolvimento.

O banco deve ser modelado pensando em histórico, rastreabilidade e evolução futura para SaaS.

Sempre que fizer sentido, incluir campos como:

- id;
- created_at;
- updated_at;
- deleted_at, quando necessário;
- created_by;
- updated_by;
- company_id, pensando em múltiplas empresas no futuro.

Mesmo que o MVP use apenas uma empresa, a estrutura deve estar preparada para multiempresa.

---

### Infraestrutura

Utilizar:

- Docker;
- Docker Compose;
- PostgreSQL em container;
- Backend em container;
- Frontend em container ou rodando em modo desenvolvimento;
- Redis opcional, preparado para uso futuro, mas não obrigatório no MVP.

Criar arquivos `.env.example` para frontend e backend.

Nunca versionar senhas reais, tokens reais ou dados sensíveis.

---

## Estrutura Modular Esperada

Organizar o projeto de forma modular.

Sugestão de estrutura:

```txt
ERP-LITE/
├── apps/
│   ├── web/
│   └── api/
├── docker/
├── docs/
├── docker-compose.yml
├── README.md
└── claude.md
```
