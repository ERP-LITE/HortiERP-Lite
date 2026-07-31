# Deploy de produção

## Arquitetura

- `gateway`: Caddy exposto nas portas 80/443, responsável por HTTPS automático e headers de segurança.
- `web`: build estático do Vue servido por Nginx numa rede interna.
- `api`: build TypeScript executado com Node.js como usuário sem privilégios.
- `migrate`: usa a mesma imagem da API e precisa terminar com sucesso antes da API iniciar.
- `postgres`: acessível apenas pela rede Docker interna, sem porta publicada.
- `backup`: gera dumps criptografados diariamente, mantém retenção local e envia uma cópia para storage S3 compatível.

## Pré-requisitos

1. Servidor Linux com Docker Engine e Compose (as imagens usam Node.js 22 na etapa de build/runtime da API).
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

## Verificação

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 api gateway
curl -I https://SEU_DOMINIO/health
```

O endpoint público `/health` é atendido pelo frontend e deve responder `200`. A API possui seu próprio `/health`,
usado internamente pelo Docker.

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

## Atualização segura

Antes de cada deploy:

```bash
npm test
npm run build:api
npm run build:web
```

## Backup automático

O container `backup` executa imediatamente ao iniciar e depois repete conforme `BACKUP_INTERVAL_SECONDS` (24 horas
por padrão). Cada dump usa o formato customizado do PostgreSQL, é criptografado com AES-256/PBKDF2 e recebe um
arquivo SHA-256. Nenhum dump em texto puro permanece no volume.

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

O teste usa somente o dump mais recente, cria o banco temporário de nome fixo `hortierp_restore_test`, restaura o
conteúdo, verifica tabelas essenciais e remove esse banco ao terminar. O banco principal nunca é apagado ou alterado.

```bash
docker compose --profile maintenance --env-file .env.production \
  -f docker-compose.production.yml run --rm restore-check
```

Execute esse teste depois do primeiro backup e pelo menos uma vez por mês. Automatize o comando por cron no servidor
e monitore o código de saída.

Para uma recuperação real, primeiro pare a API, preserve o banco danificado para investigação e restaure em um banco
novo. Nunca teste recuperação sobrescrevendo diretamente o banco principal. A senha em
`BACKUP_ENCRYPTION_PASSWORD` é indispensável; perdê-la torna os backups irrecuperáveis.
