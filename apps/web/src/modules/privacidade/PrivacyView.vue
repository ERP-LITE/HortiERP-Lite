<script setup lang="ts">
import { ArrowLeft, Sprout } from '@lucide/vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import AppFooter from '@/components/AppFooter.vue'

const atualizadoEm = '24 de agosto de 2026'
const conteudoRevisado = 'sha256-L6hHueWlg7lngW3KlYCcZ4LmewphkB9GggweSrXgnPc='
const suporte = '(47) 99154-0607'
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <header class="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <RouterLink
          :to="{ path: '/' }"
          class="flex min-w-0 items-center gap-2 text-primary-700 hover:opacity-80 dark:text-primary-400"
        >
          <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Sprout :size="20" />
          </span>
          <span class="truncate text-base font-bold">HortiERP Lite</span>
        </RouterLink>
        <ThemeToggle />
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <RouterLink
        :to="{ path: '/' }"
        class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft :size="16" /> Voltar
      </RouterLink>

      <h1 class="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Aviso de privacidade</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Atualizado em {{ atualizadoEm }}</p>

      <div class="mt-8 space-y-8 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <section>
          <p>
            Este aviso explica, sem enrolação, quais informações suas ficam guardadas no HortiERP Lite,
            para que servem, por quanto tempo ficam e o que você pode fazer sobre isso.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Quem é responsável pelos seus dados</h2>
          <p>
            <strong class="font-semibold text-gray-900 dark:text-gray-100">A empresa onde você trabalha</strong> é a
            responsável. Foi ela que decidiu usar este sistema e é ela que define o que fazer com as
            informações. Pedidos de correção ou de exclusão devem ser feitos a ela.
          </p>
          <p class="mt-2">
            O HortiERP Lite é o fornecedor do sistema. Cuidamos do funcionamento, da segurança e das
            cópias de segurança, seguindo o que a sua empresa determina — não usamos os dados para
            nenhuma outra finalidade.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">O que o sistema guarda sobre você</h2>
          <ul class="ml-5 list-disc space-y-1.5">
            <li><strong class="font-semibold">Seu nome e e-mail</strong>, para identificar quem entra no sistema.</li>
            <li>
              <strong class="font-semibold">Sua senha</strong>, guardada de forma embaralhada. Nem nós conseguimos
              descobrir qual é — só substituí-la por uma nova.
            </li>
            <li><strong class="font-semibold">Seu perfil de acesso</strong> (administrador, gerente ou operador).</li>
            <li>
              <strong class="font-semibold">O que você registrou no sistema</strong>: cada entrada de mercadoria,
              perda ou ajuste fica com o seu nome e a data. É isso que permite responder depois "quem
              lançou isso?", e é o principal motivo de o sistema existir.
            </li>
            <li>
              <strong class="font-semibold">Data, hora e o endereço da sua conexão</strong> (o número que identifica
              o aparelho na internet) a cada vez que o sistema é usado. A lei brasileira obriga a
              guardar esse registro.
            </li>
          </ul>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Por quanto tempo fica guardado</h2>
          <ul class="ml-5 list-disc space-y-1.5">
            <li>
              <strong class="font-semibold">Registro de conexão: 6 meses.</strong> Esse prazo não é escolha nossa — é
              o que o Marco Civil da Internet exige de quem oferece um sistema pela internet. Depois
              disso, é apagado automaticamente.
            </li>
            <li>
              <strong class="font-semibold">Histórico do que você lançou: 5 anos.</strong> Acompanha o prazo em que a
              movimentação de estoque ainda pode ser conferida pela fiscalização.
            </li>
            <li>
              <strong class="font-semibold">Seu cadastro:</strong> enquanto você tiver acesso. Se a sua conta for
              excluída, o nome permanece por 5 anos para o histórico continuar fazendo sentido, e
              depois é apagado — o registro deixa de apontar para você.
            </li>
          </ul>
          <p class="mt-2">A limpeza é automática, feita pelo próprio sistema toda semana.</p>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Quem pode ver</h2>
          <ul class="ml-5 list-disc space-y-1.5">
            <li>
              <strong class="font-semibold">Dentro da sua empresa:</strong> o administrador vê o histórico de quem fez
              o quê. Gerentes e operadores veem os lançamentos, mas não esse histórico.
            </li>
            <li>
              <strong class="font-semibold">Outras empresas que usam o sistema não veem nada seu.</strong> Cada
              empresa só alcança os próprios dados.
            </li>
            <li>
              <strong class="font-semibold">Nós, o fornecedor,</strong> podemos acessar os dados da sua empresa quando
              ela pede suporte. Todo acesso desse tipo fica registrado.
            </li>
          </ul>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Onde os dados ficam</h2>
          <p>
            Em um servidor <strong class="font-semibold">no Brasil, em São Paulo</strong>. As cópias de segurança são
            embaralhadas antes de sair do servidor e guardadas em outro provedor, no exterior — quem
            armazena não tem como ler o conteúdo, porque a chave não fica com eles.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Seus direitos</h2>
          <p>
            A qualquer momento você pode
            <strong class="font-semibold text-gray-900 dark:text-gray-100">baixar tudo o que o sistema guarda sobre você</strong>:
            entre em <strong class="font-semibold">Perfil</strong> e clique em
            <strong class="font-semibold">Baixar meus dados</strong>. O arquivo sai na hora, sem precisar pedir a
            ninguém.
          </p>
          <p class="mt-2">
            Você também pode pedir correção dos seus dados ou saber com quem eles são compartilhados.
            Para corrigir nome ou e-mail, fale com o administrador da sua empresa. Para as demais
            situações, use o contato no fim desta página.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Como protegemos</h2>
          <ul class="ml-5 list-disc space-y-1.5">
            <li>Todo o acesso é por conexão criptografada.</li>
            <li>Sua senha nunca é guardada de forma legível.</li>
            <li>O sistema encerra a sessão sozinho depois de 30 minutos sem uso.</li>
            <li>Cada pessoa só alcança o que o perfil dela permite, e isso é verificado no servidor.</li>
            <li>As cópias de segurança são diárias, embaralhadas e testadas.</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">O que o sistema não faz</h2>
          <p class="mb-2">Vale dizer com clareza, porque costuma ser a dúvida real de quem lê um aviso destes:</p>
          <ul class="ml-5 list-disc space-y-1.5">
            <li>Não vendemos nem compartilhamos seus dados com ninguém para propaganda.</li>
            <li>Não há anúncio nem rastreamento de navegação dentro do sistema.</li>
            <li>Não guardamos dado de saúde, biometria, religião, opinião política ou nada parecido.</li>
            <li>Não existe nenhuma decisão automática do sistema a seu respeito: ele conta estoque, não avalia pessoas.</li>
            <li>O sistema não envia e-mail — nem de aviso, nem de recuperação de senha.</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Cookies</h2>
          <p>
            O sistema usa <strong class="font-semibold">um único cookie</strong>, criado quando você entra, para
            manter você conectado. Sem ele não é possível usar o sistema. Ele não acompanha você em
            outros sites e é apagado quando você sai.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Contato</h2>
          <p>
            Dúvida sobre este aviso ou sobre seus dados: WhatsApp
            <strong class="font-semibold text-gray-900 dark:text-gray-100">{{ suporte }}</strong>.
          </p>
          <p class="mt-2">
            Se o assunto for corrigir ou apagar informação sua, comece pelo administrador da sua
            empresa — é ela a responsável pelos dados.
          </p>
        </section>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
