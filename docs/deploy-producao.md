# Deploy de produção

## Arquitetura

- `gateway`: Caddy exposto nas portas 80/443, responsável por HTTPS automático e headers de segurança.
- `web`: build estático do Vue servido por Nginx numa rede interna.
- `api`: build TypeScript executado com Node.js como usuário sem privilégios; grava anexos fiscais no volume privado `invoice_files`.
- `migrate`: usa a mesma imagem da API e precisa terminar com sucesso antes da API iniciar.
- `postgres`: acessível apenas pela rede Docker interna, sem porta publicada.
- `backup`: gera dumps do banco e arquivos compactados dos anexos, ambos criptografados diariamente, mantém retenção local e envia cópias para storage S3 compatível.

## Pré-requisitos

1. Servidor Linux com Docker Engine e Docker Compose recente, com suporte a `docker compose up --wait` (as imagens usam Node.js 22 na etapa de build/runtime da API).
2. DNS `A`/`AAAA` de `APP_DOMAIN` apontando para o servidor.
3. Portas TCP 80 e 443 e UDP 443 liberadas. Não libere a porta 5432.

## Configuração inicial

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Preencha todos os valores. Gere o JWT com, por exemplo:

```bash
openssl rand -base64 48
```

O backend recusa iniciar em produção quando o JWT tem menos de 32 caracteres ou o CORS não usa HTTPS.

`CORS_ORIGIN` aceita **uma ou várias origens separadas por vírgula**. Em produção normalmente é só o domínio público;
no desenvolvimento a lista atende ao mesmo tempo o desktop (`http://localhost:5173`) e o celular no IP da máquina na
rede local. Cada entrada é validada como URL, e em produção todas precisam ser HTTPS.

Evite caracteres reservados de URL na senha do PostgreSQL porque o Compose monta `DATABASE_URL` a partir dela.

## Primeiro deploy e atualizações

### Preparação do primeiro lançamento definitivo

Antes do **primeiro deploy que receberá dados reais**, faça uma revisão única do banco e das migrations:

1. Confirme que o destino é um PostgreSQL vazio e que nenhum ambiente que precise ser preservado depende deste
   histórico.
2. A migration `0000` já representa o schema final consolidado. Não concatene SQL antigo nem regenere essa migration
   depois que o primeiro banco de produção for criado.
3. Valide a migration partindo de um PostgreSQL vazio e execute toda a suíte de testes.
4. Não execute o seed de desenvolvimento (`db:seed`) em produção, pois ele cria empresas, usuários e dados de teste.
5. Execute apenas o bootstrap `db:seed:platform` descrito em
   [Primeiro super administrador](#primeiro-super-administrador), criando a empresa Plataforma e exatamente um
   usuário `super_admin` inicial.

> **Limite de segurança:** consolidação de migrations e reset do banco são procedimentos exclusivos do primeiro
> lançamento sem dados reais. Depois que qualquer produção estiver em uso, preserve todo o histórico, nunca apague
> o volume do PostgreSQL e publique apenas migrations incrementais. Um `docker compose down -v` remove dados,
> anexos e backups e não faz parte de uma atualização normal.

```bash
sh deploy/deploy.sh
```

O script valida o Compose, cria imagens versionadas pelo hash curto do Git, aplica migrations, inicia os serviços e
exibe o estado final. A API só inicia quando o PostgreSQL está saudável e as migrations terminam com sucesso; o
gateway só inicia quando API e frontend estão saudáveis. As imagens são construídas sequencialmente por padrão para
funcionar também em hosts com pouca memória; em um servidor maior, use `COMPOSE_PARALLEL_LIMIT=2` ou mais para
paralelizar a construção.

Para usar outro arquivo de ambiente:

```bash
sh deploy/deploy.sh /caminho/seguro/erp-production.env
```

## Atualização de uma instalação existente

Depois do primeiro deploy, preserve a migration `0000` e publique toda alteração de banco como uma nova migration
incremental. Nunca regenere, renomeie ou remova uma migration que já tenha sido aplicada. O Compose mantém banco,
anexos e backups em volumes persistentes; não remova esses volumes durante atualizações.

Não copie `.env.production.example` por cima do `.env.production` existente. Preserve os segredos atuais e acrescente
somente variáveis novas explicitamente documentadas na versão que será instalada.

Antes de atualizar o código, registre o hash/tag da versão atual e gere um backup adicional:

```bash
git rev-parse --short HEAD
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml exec backup backup.sh once
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=50 backup
```

Depois de atualizar os arquivos do repositório pelo processo adotado no servidor, execute na raiz do projeto:

```bash
npm install
npm test
npm run build:api
npm run build:web
sh deploy/deploy.sh
```

O deploy reconstrói API, frontend e backup. O serviço `migrate` aplica a migration antes de liberar a nova API, e os
dados existentes permanecem no volume `postgres_production_data`. Não execute `docker compose down -v`, pois `-v`
remove os volumes persistentes do banco, dos anexos e dos backups.

**Configuração do gateway é caso à parte.** O `deploy/caddy/Caddyfile` é *montado* do repositório, não copiado para dentro de
uma imagem, e o `docker compose up -d` só recria container cujo serviço mudou — imagem ou configuração do Compose.
Alteração no arquivo montado é invisível para o Compose, então o gateway seguiria servindo com a configuração antiga em
memória. Por isso `deploy.sh` termina com um `caddy reload`: aplica sem derrubar conexão e, se o arquivo estiver
inválido, **recusa e mantém a configuração anterior no ar** — o deploy falha em vez de derrubar o site. O
`deploy/nginx.conf` não precisa disso: ele entra na imagem do frontend (`COPY`) e chega pelo rebuild.

Confirme a migration, os serviços e o novo volume:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps -a migrate
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 migrate api web backup
docker compose --env-file .env.production -f docker-compose.production.yml config --volumes
```

O container `migrate` deve aparecer como encerrado com código `0`; API, web, gateway, PostgreSQL e backup devem estar
ativos/saudáveis. `config --volumes` deve listar `invoice_files` junto dos volumes já existentes.

A versão que introduz o controle de cobranças adiciona a migration incremental `0001_tiny_barracuda.sql`, responsável
somente pela tabela `company_billings` e seus índices. Ela preserva todas as tabelas e dados anteriores e é compatível
com a versão anterior da aplicação durante um rollback; a tabela nova apenas ficará sem uso até a versão atual voltar.

### `0004_lethal_demogoblin.sql` — e-mail de usuário sem depender de maiúsculas

Esta migration troca a restrição `users_email_unique` (sensível à caixa) pelo índice parcial
`users_email_active_unique`, sobre `lower(email)` e restrito a `deleted_at is null`. Ela também **regrava os e-mails
existentes em minúsculas**, que é a forma que a aplicação passa a usar para gravar e para procurar no login.

Ela é a única migration até aqui que pode **falhar por causa dos dados** — e falha de propósito. Se duas contas não
excluídas diferirem apenas pela caixa (`Maria@Loja.com` e `maria@loja.com`), o índice não pode ser criado, a migration
inteira é revertida (roda em transação) e o container `migrate` encerra com código diferente de `0`, sem liberar a API
nova. Fundir ou renomear duas contas distintas é decisão de negócio, não de migration.

Antes de atualizar, verifique se o caso existe:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "select lower(email) as email, count(*) from users where deleted_at is null group by 1 having count(*) > 1;"
```

Zero linhas significa que a migration aplica sem intervenção. Havendo linhas, decida por conta qual delas fica antes de
seguir, ajuste o e-mail da outra e rode a atualização novamente.

**No rollback**, a versão anterior continua funcionando com o índice novo: ela grava e-mails sem normalizar, e o índice
apenas passa a recusar duplicatas que diferem só pela caixa — que a versão antiga também já recusava na aplicação. Os
e-mails regravados em minúsculas permanecem assim, e é justamente com eles que os usuários passam a entrar.

### `0005_eager_sphinx.sql` — data do fato nas movimentações de estoque

Acrescenta `stock_movements.movement_date` (a data em que a entrada ou a perda **aconteceu**, que passa a ser a coluna
usada pelos filtros de período, pelo histórico e pelo painel), preenche as linhas existentes com `created_at` e cria o
índice `stock_movements_company_movement_date_idx`. Ver [modelo de dados](./modelo-de-dados.md#stock_movements).

**Não exige nenhuma intervenção** e não pode falhar por causa dos dados: a coluna nasce com `default now()`, o
preenchimento é uma cópia direta de `created_at` e o índice não impõe unicidade. As movimentações antigas ficam com a
data que sempre tiveram — a do lançamento, que era a única existente antes desta versão.

O que vale saber é o **custo**, porque `stock_movements` é a tabela que mais cresce numa instalação antiga: a migration
reescreve todas as linhas (o `UPDATE`) e depois constrói o índice, as duas coisas numa transação só. Enquanto isso roda,
gravações em `stock_movements` **esperam** — e a API da versão anterior continua no ar durante a migration, porque o
Compose só troca o container da API depois que o `migrate` termina. Em outras palavras: durante alguns instantes, quem
estiver lançando entrada ou perda vai ver a operação demorar. No volume típico de uma frutaria isso é imperceptível; se
a tabela já tiver muitos milhões de linhas, prefira aplicar em horário de baixo movimento. Para dimensionar antes:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "select count(*) as movimentacoes, pg_size_pretty(pg_total_relation_size('stock_movements')) as tamanho from stock_movements;"
```

**No rollback**, a versão anterior roda sem tocar no banco: ela não conhece a coluna, não a inclui no `insert`, e o
`default now()` reproduz exatamente o comportamento antigo (data do movimento = instante do lançamento). As datas
retroativas já gravadas continuam lá, e voltam a valer quando a versão atual retornar — mas, enquanto a versão anterior
estiver no ar, o histórico e o painel voltam a filtrar por `created_at`, então uma movimentação retroativa aparece no dia
em que foi digitada.

## Papel de banco da aplicação

A API **não** se conecta mais com o usuário dono do banco. São dois papéis:

| variável | papel | quem usa |
|---|---|---|
| `DATABASE_URL` | dono (`POSTGRES_USER`, superusuário) | `migrate` |
| `APP_DATABASE_URL` | `hortierp_app`, sem superusuário | `api`, `retention` |

O motivo é o RLS: superusuário ignora política de segurança em nível de linha em silêncio, então
enquanto a API falasse pelo dono nenhuma política protegeria nada. Ver `docs/decisoes-arquiteturais.md`.

O papel é criado e mantido pelo próprio `migrate`, a cada deploy — não há passo manual de `psql`. O que
**precisa existir antes do deploy** é a senha dele no `.env.production`:

```bash
cd ~/ERP-LITE
# Backup FORA da pasta do repositório: ver "Backup do .env.production não pode ficar no repositório".
cp -p .env.production ~/env-production.bak
printf 'APP_DB_USER=hortierp_app\nAPP_DB_PASSWORD=%s\n' "$(openssl rand -hex 32)" >> .env.production
grep -c '^APP_DB_' .env.production   # tem que devolver 2
```

Rode o `printf` **uma vez só**. Rodando duas vezes o arquivo fica com dois pares `APP_DB_*` e duas senhas
diferentes; não quebra nada (o `docker compose` usa a última), mas confunde depois. Para limpar:
`sed -i '/^APP_DB_USER=/d;/^APP_DB_PASSWORD=/d' .env.production` e refazer o `printf`.

Hex de propósito: senha com `@`, `:` ou `/` quebraria a URL de conexão.

Sem essa variável o `docker compose` **recusa subir** com `Defina APP_DB_PASSWORD`, antes de tocar em
qualquer container. A falha é ruidosa e acontece antes de qualquer mudança — é o comportamento desejado.

Depois do deploy, confirme que a API está mesmo no papel restrito:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml \
  logs --tail=20 migrate | grep 'Papel de aplicação'

docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  psql -U "$(grep '^POSTGRES_USER=' .env.production | cut -d= -f2)" \
       -d "$(grep '^POSTGRES_DB=' .env.production | cut -d= -f2)" \
  -c "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'hortierp_app';"
```

A linha do log deve dizer `sem superusuário, sem bypass de RLS, permissões em dia`, e a consulta deve
devolver `rolsuper = f` e `rolbypassrls = f`. Se der `t` em qualquer um dos dois, o papel foi alterado
à mão no servidor e o próximo deploy vai desfazer isso.

### Políticas de RLS e o tamanho do pool

A migration `0006_rls_por_empresa.sql` liga RLS em 13 tabelas, e a `0007` acrescenta uma exceção de leitura para o autor de registro feito pelo suporte. Elas **não** exigem variável nova
obrigatória, mas muda uma característica de produção: cada requisição passa a reservar uma conexão do
banco do início ao fim, porque é na conexão que mora a empresa da sessão. O pool passa a dimensionar
requisições simultâneas, e não consultas.

O padrão é `DATABASE_POOL_MAX=20`. Medido com 80 requisições simultâneas de listagem, o p95 ficou em
97 ms — folgado contra o limite de 750 ms do teste de carga. Se um dia faltar conexão, o sintoma é
espera na entrada da requisição (não erro de banco), e o ajuste é subir essa variável no
`.env.production`. Antes de subir muito, confira o `max_connections` do PostgreSQL (padrão: 100).

Depois do deploy, confirme que as políticas existem:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  psql -U "$(grep '^POSTGRES_USER=' .env.production | cut -d= -f2)" \
       -d "$(grep '^POSTGRES_DB=' .env.production | cut -d= -f2)" \
  -c "SELECT count(DISTINCT tablename) AS tabelas, count(*) AS politicas FROM pg_policies WHERE schemaname='public';"
```

Deve devolver **13 tabelas e 14 políticas** — a política extra é a da `0007`, que deixa o nome do
operador da plataforma visível em "Registrado por". Se vier 0, as migrations não rodaram e o
isolamento voltou a depender só da aplicação: o sistema funciona, mas sem a segunda camada.

**O backup continua no papel dono, e isso é deliberado.** `pg_dump` rodando com papel sujeito a RLS
traz só as linhas que as políticas deixam ver e termina com código zero — backup verde, dados
faltando. Não unifique `PGUSER` do serviço `backup` com `APP_DB_USER`.

## Dois cuidados que o deploy não perdoa

### `npm run db:seed` nunca em produção

`db:seed` cria a empresa Demo e três contas com senha conhecida (`admin123` e companhia). O comando é
vizinho de `db:migrate` no roteiro, e o erro de rodar os dois juntos numa instalação real entregaria um
**administrador completo de uma empresa-cliente** a quem souber o padrão.

Hoje o próprio script recusa: `assertNotProduction` aborta com código 1 quando `NODE_ENV=production`,
sem tocar no banco. Para criar o primeiro acesso de uma instalação real o comando é
`npm run db:seed:platform`, que exige `PLATFORM_ADMIN_EMAIL` e `PLATFORM_ADMIN_PASSWORD` e não tem
senha embutida.

### Backup do `.env.production` não pode ficar no repositório

O `rsync` do deploy roda com `--delete` e exclui `.env.production` pelo **nome exato**. Um
`.env.production.bak` ao lado dele não casa com o filtro, então **o próximo deploy apaga o backup**.

Para segredo em texto puro isso é até desejável, mas não sirva de backup para rollback: se você precisar
voltar uma variável, o arquivo não vai estar lá. Copie sempre para fora da pasta do repositório
(`~/env-production.bak`) e apague depois de confirmar.

### O `.env.production` fica fora do Git

O arquivo guarda `POSTGRES_PASSWORD`, `JWT_SECRET`, `BACKUP_ENCRYPTION_PASSWORD` e as chaves de acesso
do bucket de backup. O `.gitignore` cobre `.env.*` justamente por isso — antes cobria só `.env`, e
`.env.production` ficava rastreável no diretório onde este guia manda criá-lo.

Se em algum momento ele **foi** comitado, remover do histórico não basta: trate as quatro chaves como
queimadas e troque todas. `JWT_SECRET` vazado permite forjar sessão de qualquer usuário de qualquer
empresa, e a chave do bucket dá acesso aos backups.

Confira antes de um `git add` no servidor:

```bash
git check-ignore -v .env.production   # deve responder com a regra que o ignora
git status --short | grep -i env      # não deve listar nada além dos .example
```

### Ao mexer no `index.html`, recalcule o hash da CSP

A CSP autoriza o único script inline do `index.html` por `sha256-…`, em vez de liberar
`'unsafe-inline'` (ver [decisões arquiteturais](./decisoes-arquiteturais.md#csp-sem-unsafe-inline-o-hash-do-script-do-tema)).
O hash aparece em `deploy/caddy/Caddyfile` e duas vezes em `deploy/nginx.conf`.

A falha é silenciosa: hash divergente bloqueia o script e o tema escuro volta a piscar branco no
carregamento — nada quebra, e ninguém percebe até o cliente reclamar. O CI roda `npm run csp:hash` e
falha o build; localmente, `npm run csp:hash -- --write` atualiza os três lugares.

## Deploy automático pelo GitHub Actions

O workflow `.github/workflows/ci.yml` publica automaticamente na Oracle Cloud depois que os builds, as migrations
de teste e os testes de integração passam em um `push` para a branch `main`. Pull requests e outras branches executam
somente o CI e nunca alteram a produção.

Cadastre estes segredos no repositório em **Settings > Secrets and variables > Actions > New repository secret**:

- `ORACLE_HOST`: IP público da VM, por exemplo `163.176.246.92`.
- `ORACLE_USER`: usuário SSH, normalmente `ubuntu`.
- `ORACLE_SSH_PRIVATE_KEY_BASE64`: chave privada autorizada na VM codificada em Base64, em uma única linha.
- `ORACLE_SSH_KNOWN_HOSTS`: linha da chave pública do host retornada por `ssh-keyscan` e conferida antes do cadastro.

Use de preferência uma chave SSH exclusiva para o GitHub Actions, sem senha, em vez da chave pessoal usada no
terminal. Adicione apenas a chave pública correspondente ao arquivo `~/.ssh/authorized_keys` do usuário `ubuntu` na
VM. Gere o valor Base64 com `base64 -w 0 /caminho/da/chave_privada`. O workflow nunca envia nem sobrescreve
`.env.production`, `.env`, `apps/api/.env` ou `apps/web/.env`.

O código é sincronizado em `/home/ubuntu/ERP-LITE` e o `deploy/deploy.sh` é executado com o SHA do commit como tag
das imagens. Os deploys da mesma branch não são executados simultaneamente. O resultado pode ser acompanhado na aba
**Actions** do repositório; produção só é atualizada quando o job **Deploy to Oracle Cloud** termina com sucesso.

Faça também um teste funcional autenticado:

1. Abra uma entrada existente e confirme que produtos, quantidades e unidades continuam corretos.
2. Registre uma entrada com dados fiscais e anexe uma imagem ou PDF pequeno.
3. Confira pré-visualização e download; XML deve oferecer somente download.
4. Edite fornecedor ou dados fiscais com admin/gerente e confirme que os itens e o estoque não mudaram.
5. Confirme que operador não vê a exclusão; admin/gerente deve conseguir excluir após confirmação.
6. Entre como `super_admin`, acesse uma empresa por impersonação e valide as mesmas ações administrativas.
7. Cadastre uma empresa de teste com CNPJ, contato e endereço; confira validação de duplicidade e preenchimento do
   CEP. Se os provedores externos estiverem indisponíveis, confirme que o endereço ainda aceita digitação manual.
8. Gere outro backup e execute o teste de restauração para incluir e validar o pacote de anexos.
9. Entre como `super_admin`, abra `/cobrancas`, crie uma mensalidade de teste e valide os filtros e a marcação como
   paga antes de remover o registro de teste.

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec backup backup.sh once
docker compose --profile maintenance --env-file .env.production \
  -f docker-compose.production.yml run --rm restore-check
```

## Verificação

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 api gateway
curl -I https://SEU_DOMINIO/health
```

O endpoint público `/health` é atendido pelo frontend e deve responder `200`. A API possui seu próprio `/health`,
usado internamente pelo Docker; ele só responde `200` depois de consultar o PostgreSQL e confirmar que o volume
privado de anexos está gravável. Falha em qualquer dependência retorna `503` e impede o deploy de ser marcado como
concluído.

A checagem do volume não cria arquivo nenhum: ela garante o diretório e consulta a permissão de escrita. Um marcador
gravado a cada chamada ficaria misturado aos anexos fiscais e entraria nos backups junto com eles. Volume não
montado falha ao criar o diretório e permissão incompatível falha no `access(W_OK)`. Essa verificação não substitui
monitoramento de espaço livre nem uma gravação real periódica, necessários para detectar disco cheio e alguns erros
de I/O.

## Primeiro super administrador

Depois do primeiro deploy, crie a empresa Plataforma e o primeiro acesso sem registrar a senha no histórico do shell:

```bash
read -r PLATFORM_ADMIN_EMAIL
read -rs PLATFORM_ADMIN_PASSWORD
export PLATFORM_ADMIN_EMAIL PLATFORM_ADMIN_PASSWORD
docker compose --env-file .env.production -f docker-compose.production.yml exec \
  -e PLATFORM_ADMIN_EMAIL -e PLATFORM_ADMIN_PASSWORD api node dist/db/seedPlatform.js
unset PLATFORM_ADMIN_EMAIL PLATFORM_ADMIN_PASSWORD
```

Esse bootstrap deve ser executado **uma única vez** e é idempotente: se a empresa Plataforma já existir, ele não cria
outro usuário. No primeiro lançamento, não cadastre outros administradores da plataforma até concluir a validação.
Empresas-cliente e seus primeiros administradores devem ser criados depois pela interface autenticada.

Confirme que existe somente um `super_admin` inicial:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT role, count(*) FROM users WHERE deleted_at IS NULL GROUP BY role ORDER BY role;"'
```

O resultado esperado nesse momento é uma única linha, com papel `super_admin` e contagem `1`. Não coloque
`PLATFORM_ADMIN_PASSWORD` permanentemente no arquivo de ambiente e não deixe a senha no histórico do shell.

## Rollback

Guarde o `IMAGE_TAG` exibido por cada deploy. Para voltar os containers a uma imagem anterior:

```bash
sh deploy/rollback.sh IMAGE_TAG_ANTERIOR
```

O rollback não desfaz migrations automaticamente. Migrations novas devem ser compatíveis com a versão anterior ou
ter um procedimento específico e testado de restauração do banco.

O volume `invoice_files` e todas as migrations aplicadas devem permanecer durante um rollback. Antes de cada nova
migration, documente se a versão anterior da aplicação continua compatível com o schema novo; se não continuar, o
rollback exige restauração coordenada do backup e não apenas a troca da imagem.

### A `0006` não é compatível com a versão anterior da aplicação

A migration das políticas de RLS é a **primeira** que quebra o rollback só por troca de imagem. A versão
anterior da API não define a empresa da sessão na conexão, e a política exige essa variável para
devolver linha. Trocar a imagem sem desfazer as políticas faz o sistema subir saudável e **mostrar tudo
vazio** — nenhum erro, nenhum dado.

Se precisar voltar a imagem, desligue as políticas junto:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  psql -U "$(grep '^POSTGRES_USER=' .env.production | cut -d= -f2)" \
       -d "$(grep '^POSTGRES_DB=' .env.production | cut -d= -f2)" -c "
DO \$\$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END \$\$;"
```

Isso **desliga** o RLS sem apagar as políticas: elas voltam a valer com um
`ALTER TABLE … ENABLE ROW LEVEL SECURITY` quando a versão nova voltar ao ar. Os dados não são tocados.

### Compatibilidade das migrations

| Migration | Versão anterior roda no schema novo? | Observação |
|---|---|---|
| `0003` — `losses.cancelled_at`, `cancelled_by`, `cancel_reason` | **Sim** | Três colunas nuláveis. O Drizzle lista as colunas explicitamente no `select`, então a versão anterior simplesmente não as enxerga, e o `insert` antigo as deixa nulas. Rollback por troca de imagem é seguro, sem tocar no banco. |
| `0005` — `stock_movements.movement_date` | **Sim** | Coluna `not null`, mas com `default now()`: o `insert` da versão anterior a omite e o banco preenche com o instante do lançamento, que é o comportamento dela. Rollback por troca de imagem é seguro. A ressalva é de leitura, não de escrita — a versão anterior filtra período por `created_at`, então movimentações lançadas com data retroativa aparecem no dia em que foram digitadas enquanto ela estiver no ar. |
| `0008` — `categories.active`, `units.active` | **Sim** | Duas colunas `not null` com `default true`: o `insert` da versão anterior as omite e nascem ativas, que é o comportamento dela. Rollback por troca de imagem é seguro. A ressalva é de leitura: enquanto a versão anterior estiver no ar, cadastro inativado volta a aparecer nas opções de produto novo, porque ela não conhece a coluna. |

O sentido inverso **não** é compatível e vale para qualquer migration: restaurar um dump anterior à migration e apontar
o código **atual** para ele quebra toda consulta que use as colunas novas. Depois de restaurar um backup antigo, rode as
migrations antes de subir a aplicação:

```bash
IMAGE_TAG=<tag_em_producao> docker compose --env-file .env.production \
  -f docker-compose.production.yml run --rm migrate
```

O `IMAGE_TAG` é obrigatório aqui: sem ele o Compose assume `latest`, que pode não existir porque o deploy versiona as
imagens pelo hash curto do Git. Na dúvida, o caminho mais simples é redeployar — um deploy normal já aplica as
migrations sozinho (o container `migrate` roda antes de a API subir). O `restore-test.sh` não cobre esse ponto de propósito: ele valida a **integridade do backup**, não a
compatibilidade com a versão de código em execução — por isso passa mesmo com um dump antigo.

## Atualização segura

Antes de cada deploy:

```bash
npm test
npm run build:api
npm run build:web
```

## Backup automático

O container `backup` executa imediatamente ao iniciar e depois repete conforme `BACKUP_INTERVAL_SECONDS` (24 horas
por padrão). Cada dump usa o formato customizado do PostgreSQL; os anexos do volume `invoice_files` são empacotados
separadamente. Os dois artefatos são criptografados com AES-256/PBKDF2 e recebem arquivos SHA-256. Nenhum dump ou
arquivo fiscal em texto puro permanece no volume de backup.

Os arquivos ficam no volume `backup_data` e, quando `BACKUP_REMOTE_PATH` está preenchido, também são enviados por
`rclone` para um storage S3 compatível. O backup local no mesmo servidor não é suficiente para clientes reais;
configure AWS S3, Cloudflare R2, Backblaze B2 ou equivalente e mantenha a chave de criptografia em outro local.

Para executar um backup adicional imediatamente:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec backup backup.sh once
```

Confira o histórico e o health check:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 backup
docker compose --env-file .env.production -f docker-compose.production.yml ps backup
```

## Limpeza de anexos órfãos

O upload de nota grava o arquivo em disco antes de inserir a linha em `stock_entry_attachments`. Uma queda da API ou
do container entre as duas etapas deixa um arquivo sem dono, e nenhum fluxo da aplicação o remove — ele passa a
ocupar o volume `invoice_files` e a entrar em todos os backups criptografados junto com os anexos legítimos.

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec api \
  node dist/scripts/cleanupInvoiceOrphans.js --dry-run
docker compose --env-file .env.production -f docker-compose.production.yml exec api \
  node dist/scripts/cleanupInvoiceOrphans.js
```

**Use `node dist/...`, não `npm run`.** Os atalhos do `package.json` chamam `tsx src/...`, e a imagem
de produção não tem nenhum dos dois: o `Dockerfile` roda `npm prune --omit=dev` (que remove o `tsx`) e
copia apenas `dist`, sem o `src`. O `npm run` funciona no ambiente de desenvolvimento; em produção o
caminho é sempre o arquivo compilado.

O script só apaga arquivos que não têm registro correspondente **e** foram modificados há mais de 24 horas; a
carência evita remover um upload em andamento. Comece sempre pelo `--dry-run`, que lista os candidatos sem tocar em
nada. Agende mensalmente — a frequência não precisa ser alta, já que só quedas no meio de um upload geram órfãos.

## Retenção de dados pessoais

`system_logs` (uma linha por requisição, com endereço IP e navegador) e `activity_logs` (auditoria de
negócio, com o nome de quem fez) guardam dado pessoal. A LGPD manda eliminá-lo quando a finalidade
termina, e o script `retentionPurge` é quem faz isso.

Os prazos não são preferência, são consequência de duas leis que empurram em sentidos opostos:

| Dado | Prazo | Por quê |
|---|---|---|
| `system_logs` | **180 dias** | Piso do Marco Civil da Internet (art. 15): provedor de aplicação com fins econômicos guarda data, hora e IP por 6 meses. A LGPD manda não guardar além do necessário, então o padrão é exatamente o piso. A API **recusa subir** com `TECHNICAL_LOG_RETENTION_DAYS` menor que 180. |
| `activity_logs` | **5 anos** | Acompanha o prazo de fiscalização tributária. A trilha só tem valor enquanto responde "quem lançou a movimentação deste período". Ajustável por `AUDIT_RETENTION_DAYS`, que vale para esta linha e para a seguinte. |
| Usuário excluído | **5 anos** | Depois disso o nome e o e-mail são substituídos e o vínculo com a pessoa é cortado. O `id` continua, para o histórico não virar um buraco, mas deixa de levar a alguém. |

```bash
# Sempre comece pelo dry-run: ele conta sem apagar nada.
docker compose --env-file .env.production -f docker-compose.production.yml exec api \
  node dist/scripts/retentionPurge.js --dry-run

docker compose --env-file .env.production -f docker-compose.production.yml exec api \
  node dist/scripts/retentionPurge.js
```

**Não precisa agendar nada na VM.** O serviço `retention` do `docker-compose.production.yml` roda o
script em laço, uma vez por semana, e sobe junto com o deploy. Os comandos acima servem para rodar
fora de hora — conferir volumes antes de mexer num prazo, por exemplo.

A escolha de container em vez de cron é deliberada: cron mora fora do repositório e fora do deploy,
então precisaria ser criado à mão em cada máquina — e seria esquecido numa troca de servidor, com a
retenção deixando de existir sem ninguém notar. É o mesmo motivo pelo qual o backup também roda em
laço num container, e não por cron.

O intervalo é ajustável por `RETENTION_INTERVAL_SECONDS` no `.env.production` (padrão: 604800, uma
semana).

**Configure o `RETENTION_HEARTBEAT_URL`.** Crie uma verificação **nova** no monitor, não reaproveite a
do backup: se as duas apontarem para a mesma URL, o sinal da retenção mascara uma falha de backup — o
alerta mais importante que existe aqui. O período esperado é semanal, diferente do backup, que é
diário.

Sem o sinal, uma falha semanal passa em silêncio: o contêiner
tenta, erra, dorme e tenta de novo, e você só descobriria meses depois pelo tamanho das tabelas. Com
ele, a retenção chama a URL quando termina bem e a URL seguida de `/fail` quando falha. É o mesmo
esquema do `BACKUP_HEARTBEAT_URL`, então serve o mesmo monitor externo, só com outro sinal. O
`--dry-run` não avisa nada, porque não alterou nada.

Para acompanhar:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=20 retention
```

Para dimensionar as tabelas antes de mexer em qualquer prazo:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_catalog.pg_statio_user_tables order by pg_total_relation_size(relid) desc limit 10;"
```

## Apagar em definitivo os dados de uma empresa

No encerramento de um contrato, a LGPD (arts. 15 e 16) exige eliminar os dados quando a finalidade
acaba. O `eraseCompany` faz isso: apaga as linhas de todas as tabelas daquela empresa e os arquivos de
nota fiscal do disco. **É irreversível e não existe tela para isso de propósito** — uma rota HTTP
seria um botão a um clique de apagar o cliente errado.

```bash
# 1. Descubra o id e confira os volumes. Nada é apagado aqui.
docker compose --env-file .env.production -f docker-compose.production.yml exec api \
  node dist/scripts/eraseCompany.js --id=<uuid> --dry-run

# 2. Apague, repetindo o nome exato que o dry-run mostrou.
docker compose --env-file .env.production -f docker-compose.production.yml exec api \
  node dist/scripts/eraseCompany.js --id=<uuid> --confirm="Nome Exato da Empresa"
```

O script recusa rodar se o `--confirm` não corresponder ao nome, e recusa apagar a empresa da
plataforma — que destruiria o próprio acesso de super admin.

**Faça um backup antes, e saiba o que ele significa.** Os backups já enviados continuam contendo os
dados apagados até expirarem pela regra de ciclo de vida do bucket (30 dias). Se o contrato exigir
eliminação imediata inclusive dos backups, isso é operação manual no painel do provedor — o script
não alcança lá, e prometer o contrário no contrato seria falso.

## Teste de restauração

O teste usa o dump mais recente, cria o banco temporário de nome fixo `hortierp_restore_test`, restaura o conteúdo,
verifica tabelas essenciais e valida checksum e descriptografia do pacote mais recente de anexos. O pacote é extraído
num diretório temporário e cada `storedName` do banco restaurado precisa corresponder a um arquivo real; banco com
anexos e pacote ausente também reprova o teste. Depois, banco e arquivos temporários são removidos. O banco principal
e o volume real de anexos nunca são apagados ou alterados.

```bash
docker compose --profile maintenance --env-file .env.production \
  -f docker-compose.production.yml run --rm restore-check
```

Execute esse teste depois do primeiro backup e pelo menos uma vez por mês. Automatize o comando por cron no servidor
e monitore o código de saída.

Para uma recuperação real, primeiro pare a API, preserve o banco danificado para investigação e restaure em um banco
novo. Nunca teste recuperação sobrescrevendo diretamente o banco principal. A senha em
`BACKUP_ENCRYPTION_PASSWORD` é indispensável; perdê-la torna os backups irrecuperáveis.
