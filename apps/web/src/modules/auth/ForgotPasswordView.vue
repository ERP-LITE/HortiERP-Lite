<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { MailCheck } from '@lucide/vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { resolveFormError } from '@/services/api'
import { requestPasswordReset } from '@/services/authService'
import { useFieldErrors } from '@/composables/useFieldErrors'
import { LIMITES_TEXTO } from '@/lib/limits'

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const { fieldErrors } = useFieldErrors(() => ({ email: email.value }))
const enviado = ref(false)

// Mesmo formato do `validate()` das telas de cadastro: erro por campo, em vermelho embaixo dele.
function validate(): boolean {
  fieldErrors.value = {}
  if (!email.value.trim()) fieldErrors.value.email = 'Informe o e-mail'
  return Object.keys(fieldErrors.value).length === 0
}

async function handleSubmit() {
  errorMessage.value = ''
  if (!validate()) return

  loading.value = true

  try {
    await requestPasswordReset(email.value)
    enviado.value = true
  } catch (error) {
    const resolved = resolveFormError(error, 'Não foi possível pedir a redefinição. Tente novamente.')
    fieldErrors.value = resolved.fieldErrors
    errorMessage.value = resolved.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <div v-if="enviado" class="space-y-4 text-center">
      <MailCheck :size="36" class="mx-auto text-primary-600 dark:text-primary-400" />
      <div class="space-y-2">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Verifique seu e-mail</h2>
        <!-- A mensagem vale tanto para quem tem conta quanto para quem não tem, de propósito: a
             tela não pode ser um jeito de descobrir quais e-mails estão cadastrados. -->
        <p class="text-sm text-gray-600 dark:text-gray-300">
          Se houver uma conta com esse e-mail, as instruções de redefinição já foram enviadas. O link vale por
          pouco tempo e só pode ser usado uma vez.
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Não chegou? Confira a caixa de spam antes de pedir de novo.
        </p>
      </div>
      <RouterLink :to="{ name: 'login' }" class="block">
        <BaseButton variant="secondary" class="w-full">Voltar para o login</BaseButton>
      </RouterLink>
    </div>

    <form v-else class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <div class="space-y-1">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Esqueci minha senha</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Informe o e-mail da sua conta e enviaremos um link para você escolher uma senha nova.
        </p>
      </div>

      <BaseInput
        v-model="email"
        type="email"
        label="E-mail"
        placeholder="seu@email.com"
        :maxlength="LIMITES_TEXTO.email"
        :error="fieldErrors.email"
        required
      />

      <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

      <BaseButton type="submit" class="w-full" :disabled="loading">
        {{ loading ? 'Enviando...' : 'Enviar link de redefinição' }}
      </BaseButton>

      <RouterLink
        :to="{ name: 'login' }"
        class="block text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Voltar para o login
      </RouterLink>
    </form>
  </AuthLayout>
</template>
