<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { changePassword, fetchOwnPersonalData } from '@/services/authService'
import { getApiErrorMessage } from '@/services/api'
import { toastError, toastSuccess } from '@/lib/alerts'
import { Download } from '@lucide/vue'
import { downloadBlob } from '@/lib/download'
import { roleLabel } from '@/lib/roles'
import { LIMITES_TEXTO } from '@/lib/limits'

const auth = useAuthStore()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  errorMessage.value = ''

  if (!currentPassword.value || !newPassword.value) {
    errorMessage.value = 'Informe a senha atual e a nova senha'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'A confirmação de senha não confere com a nova senha'
    return
  }

  saving.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    toastSuccess('Senha alterada com sucesso')
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Não foi possível alterar a senha')
  } finally {
    saving.value = false
  }
}

const downloading = ref(false)

async function handleDownloadPersonalData() {
  if (downloading.value) return

  downloading.value = true
  try {
    const data = await fetchOwnPersonalData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(`meus-dados-${new Date().toISOString().slice(0, 10)}.json`, blob)
    toastSuccess('Download dos seus dados iniciado')
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível baixar seus dados'))
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Meu perfil" subtitle="Seus dados de acesso" />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Dados da conta</h2>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Nome</dt>
            <dd class="break-all text-gray-900 dark:text-gray-100 font-medium">{{ auth.user?.name }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">E-mail</dt>
            <dd class="break-all text-gray-900 dark:text-gray-100 font-medium">{{ auth.user?.email }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Perfil</dt>
            <dd class="text-gray-900 dark:text-gray-100 font-medium">
              {{ roleLabel(auth.user?.role) }}
            </dd>
          </div>
        </dl>

        <div class="mt-6 border-t border-gray-100 dark:border-gray-700 pt-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Meus dados pessoais</h3>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Baixe tudo o que o sistema guarda sobre você: seu cadastro e o histórico das ações que você
            registrou. O arquivo é seu e pode ser aberto em qualquer computador.
          </p>
          <BaseButton
            type="button"
            variant="secondary"
            class="mt-3"
            :disabled="downloading"
            @click="handleDownloadPersonalData"
          >
            <Download :size="16" />
            {{ downloading ? 'Preparando...' : 'Baixar meus dados' }}
          </BaseButton>
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Quer saber o que o sistema guarda e por quanto tempo? Leia o
            <RouterLink
              :to="{ name: 'privacidade' }"
              target="_blank"
              class="text-primary-700 hover:underline dark:text-primary-400"
            >aviso de privacidade</RouterLink>.
          </p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Redefinir senha</h2>
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <BaseInput
            v-model="currentPassword"
            type="password"
            label="Senha atual"
            :maxlength="LIMITES_TEXTO.senha"
            required
          />
          <BaseInput
            v-model="newPassword"
            type="password"
            label="Nova senha"
            :maxlength="LIMITES_TEXTO.senha"
            required
          />
          <BaseInput
            v-model="confirmPassword"
            type="password"
            label="Confirmar nova senha"
            :maxlength="LIMITES_TEXTO.senha"
            required
          />

          <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

          <div class="flex justify-end">
            <BaseButton type="submit" :disabled="saving">
              {{ saving ? 'Salvando...' : 'Alterar senha' }}
            </BaseButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
