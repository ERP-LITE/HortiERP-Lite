<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { resolveFormError } from '@/services/api'
import { resetPassword } from '@/services/authService'
import { useFieldErrors } from '@/composables/useFieldErrors'
import { toastSuccess } from '@/lib/alerts'
import { validateNewPassword } from '@/lib/passwordForm'
import { SENHA_MIN } from '@/lib/limits'

const route = useRoute()
const router = useRouter()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const errorMessage = ref('')
const { fieldErrors } = useFieldErrors(() => ({
  newPassword: newPassword.value,
  confirmPassword: confirmPassword.value,
}))

function validate(): boolean {
  fieldErrors.value = {}
  validateNewPassword(newPassword.value, confirmPassword.value, fieldErrors.value)

  return Object.keys(fieldErrors.value).length === 0
}

async function handleSubmit() {
  errorMessage.value = ''
  if (!validate()) return

  saving.value = true
  try {
    await resetPassword(token.value, newPassword.value)
    toastSuccess('Senha redefinida. Entre com a senha nova.')
    router.push({ name: 'login' })
  } catch (error) {
    const resolved = resolveFormError(error, 'Não foi possível redefinir a senha')
    // `token` vem da URL e não tem campo na tela: sem separá-lo, um erro de validação nele não
    // apareceria em lugar nenhum e o botão pareceria não fazer nada.
    const { token: erroDoLink, ...deCampo } = resolved.fieldErrors

    fieldErrors.value = deCampo
    errorMessage.value = erroDoLink ?? resolved.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <div v-if="!token" class="space-y-4 text-center">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Link incompleto</h2>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Este endereço não traz o código de redefinição. Abra o link direto do e-mail que você recebeu, sem
        recortar nem reescrever, ou peça uma nova redefinição.
      </p>
      <RouterLink :to="{ name: 'esqueci-senha' }" class="block">
        <BaseButton class="w-full">Pedir nova redefinição</BaseButton>
      </RouterLink>
    </div>

    <form v-else class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <div class="space-y-1">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Escolher nova senha</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Use ao menos {{ SENHA_MIN }} caracteres. Ao confirmar, qualquer sessão aberta com a senha antiga é
          encerrada.
        </p>
      </div>

      <BaseInput
        v-model="newPassword"
        type="password"
        label="Nova senha"
        placeholder="••••••••"
        :error="fieldErrors.newPassword"
        required
      />
      <BaseInput
        v-model="confirmPassword"
        type="password"
        label="Confirmar nova senha"
        placeholder="••••••••"
        :error="fieldErrors.confirmPassword"
        required
      />

      <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

      <BaseButton type="submit" class="w-full" :disabled="saving">
        {{ saving ? 'Salvando...' : 'Redefinir senha' }}
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
