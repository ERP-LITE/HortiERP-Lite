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
4. Widget Turnstile real restrito ao domínio de produção.

## Configuração inicial

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Preencha todos os valores. Gere o JWT com, por exemplo:

```bash
openssl rand -base64 48
```

O backend recusa iniciar em produção quando o JWT tem menos de 32 caracteres, o CORS não usa HTTPS ou a chave
Turnstile é uma chave oficial de teste. O build do frontend também recusa as site keys de teste conhecidas.

Evite caracteres reservados de URL na senha do PostgreSQL porque o Compose monta `DATABASE_URL` a partir dela.

## Primeiro deploy e atualizações

```bash
sh deploy/deploy.sh
```

O script valida o Compose, cria imagens versionadas pelo hash curto do Git, aplica migrations, inicia os serviços e
exibe o estado final. A API só inicia quando o PostgreSQL está saudável e as migrations terminam com sucesso; o
gateway só inicia quando API e frontend estão saudáveis.

Para usar outro arquivo de ambiente:

```bash
sh deploy/deploy.sh /caminho/seguro/erp-production.env
```

## Atualização de uma instalação existente

Esta versão adiciona dados e anexos privados de notas fiscais às entradas de mercadoria. A atualização é aditiva:
a migration `0006_brief_scarlet_spider.sql` cria as colunas fiscais e a tabela `stock_entry_attachments`, sem alterar
estoques ou entradas já existentes. O Compose cria automaticamente o volume persistente `invoice_files`; não remova
esse volume em atualizações futuras.

Não copie `.env.production.example` por cima do `.env.production` existente. Preserve os segredos atuais. A única
variável nova é opcional:

```dotenv
# Limite por anexo; se ausente, usa 10 MB.
INVOICE_MAX_FILE_SIZE=10485760
```

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

Confirme a migration, os serviços e o novo volume:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps -a migrate
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 migrate api web backup
docker compose --env-file .env.production -f docker-compose.production.yml config --volumes
```

O container `migrate` deve aparecer como encerrado com código `0`; API, web, gateway, PostgreSQL e backup devem estar
ativos/saudáveis. `config --volumes` deve listar `invoice_files` junto dos volumes já existentes.

Faça também um teste funcional autenticado:

1. Abra uma entrada existente e confirme que produtos, quantidades e unidades continuam corretos.
2. Registre uma entrada com dados fiscais e anexe uma imagem ou PDF pequeno.
3. Confira pré-visualização e download; XML deve oferecer somente download.
4. Edite fornecedor ou dados fiscais com admin/gerente e confirme que os itens e o estoque não mudaram.
5. Confirme que operador não vê a exclusão; admin/gerente deve conseguir excluir após confirmação.
6. Entre como `super_admin`, acesse uma empresa por impersonação e valide as mesmas ações administrativas.
7. Gere outro backup e execute o teste de restauração para incluir e validar o pacote de anexos.

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

## Rollback

Guarde o `IMAGE_TAG` exibido por cada deploy. Para voltar os containers a uma imagem anterior:

```bash
sh deploy/rollback.sh IMAGE_TAG_ANTERIOR
```

O rollback não desfaz migrations automaticamente. Migrations novas devem ser compatíveis com a versão anterior ou
ter um procedimento específico e testado de restauração do banco.

Nesta atualização, a migration fiscal é aditiva e a versão anterior ignora as novas colunas/tabela, portanto o
rollback apenas da aplicação é possível. O volume `invoice_files` e a migration devem permanecer; não os apague
durante o rollback. Anexos enviados enquanto a versão nova esteve ativa voltarão a aparecer quando ela for publicada
novamente.

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
