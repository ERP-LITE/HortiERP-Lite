# Teste de carga

Dois cenários, escolhidos por `LOAD_SCENARIO`:

- **`read`** (padrão) — `read-flow.js` mede o fluxo autenticado de leitura mais comum sem alterar estoque ou poluir
  dados. Cada usuário virtual alterna entre sessão, dashboard, estoque, entradas, movimentações e relatório por
  categoria.
- **`write`** — `write-flow.js` exercita os caminhos onde a concorrência realmente importa e que a leitura não
  alcança: criação de entrada de mercadoria (atualização atômica de estoque), upload de anexo fiscal (gravação em
  disco + advisory lock por entrada) e registro de perda (decremento com validação de saldo). **Grava dados de
  verdade.**

## Segurança

- Rode preferencialmente em ambiente local ou homologação com dados descartáveis.
- O script recusa destinos remotos por padrão. Nunca use produção durante horário de operação.
- Para homologação remota, confirme autorização com `ALLOW_REMOTE_LOAD_TEST=true` e forneça credenciais próprias.
- O login acontece uma vez no `setup`, evitando que o rate limit seja o objeto involuntário do teste.
- Em `development`/`test`, somente o agente exato `HortiERP-Load-Test/1.0` é ignorado pelo rate limit global para que
  um único container consiga representar vários clientes. Essa exceção é desativada pelo código quando
  `NODE_ENV=production`; o rate limit de produção permanece intacto.
- O cenário `write` exige `ALLOW_WRITE_LOAD_TEST=true` em **dois** pontos independentes: o script de execução recusa
  antes de subir o container, e o próprio `setup` do k6 aborta se a variável não chegar. Apontar o cenário de escrita
  para o alvo errado suja a base e ainda consome disco com anexos.
- A rota de anexos tem rate limit próprio de 10/min. O agente do teste de carga é isento fora de produção; se o
  cenário `write` receber `429`, ele aborta com mensagem explícita em vez de reportar falha de desempenho.

## Execução local

Com os containers e o seed de desenvolvimento ativos:

```bash
LOAD_PROFILE=smoke sh scripts/run-load-test.sh
LOAD_PROFILE=baseline sh scripts/run-load-test.sh
LOAD_PROFILE=stress sh scripts/run-load-test.sh
```

Cenário de escrita (base descartável, com seed aplicado):

```bash
LOAD_SCENARIO=write ALLOW_WRITE_LOAD_TEST=true LOAD_PROFILE=smoke sh scripts/run-load-test.sh
```

Perfis de leitura:

- `smoke`: chega a 5 usuários virtuais em 40 segundos; valida configuração.
- `baseline`: chega gradualmente a 30 usuários em 3 minutos; referência inicial recomendada.
- `stress`: chega a 80 usuários em 5 minutos; identifica o início da degradação.

Perfis de escrita (menores de propósito — cada iteração abre transação e mexe em disco, então números altos mediriam
o hardware, não o sistema): `smoke` vai a 3 usuários, `baseline` a 15 e `stress` a 30.

Critérios de aprovação:

| | leitura | escrita |
|---|---|---|
| Checks aprovados | > 99% | > 99% |
| Requisições com falha | < 1% | < 1% |
| p95 | 750 ms | 1500 ms |
| p99 | 1,5 s | 3 s |

Os limites de escrita são mais folgados porque cada operação passa por transação, lock de linha e, no caso de anexo,
gravação em disco.

Dois retornos `422` contam como sucesso no cenário de escrita, e isso é intencional: perda sem saldo suficiente e
anexo além do limite de 3 por entrada são as guardas de concorrência funcionando. Tratá-los como erro faria o teste
reprovar justamente quando o sistema se comportou certo.

O comando termina com código diferente de zero quando um limite é violado e salva o resumo JSON em
`tests/load/results/`, com o cenário no nome do arquivo.

Depois de rodar o cenário de escrita, os anexos criados ficam no volume. Para devolver o disco ao estado anterior,
veja a limpeza de órfãos abaixo.

## Limpeza depois do teste de escrita

O cenário `write` cria entradas, perdas e anexos reais. Registros de banco saem com um novo seed; os arquivos em
disco, não. Rode:

```bash
npm run invoices:cleanup -- --dry-run   # confere o que seria apagado
npm run invoices:cleanup                # apaga de fato
```

O script só remove arquivos sem linha correspondente em `stock_entry_attachments`, então rodá-lo antes de recriar o
banco não adianta — recrie o banco primeiro, aí os anexos ficam órfãos e a limpeza os alcança.

## Homologação remota

```bash
BASE_URL=https://homologacao.exemplo.com \
ALLOW_REMOTE_LOAD_TEST=true \
LOAD_PROFILE=baseline \
LOAD_TEST_EMAIL=operador-carga@exemplo.com \
LOAD_TEST_PASSWORD='senha-exclusiva' \
sh scripts/run-load-test.sh
```
