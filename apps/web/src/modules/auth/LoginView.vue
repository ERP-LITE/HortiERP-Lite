<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import TurnstileWidget from '@/components/ui/TurnstileWidget.vue'
import { useAuthStore } from '@/stores/auth'
import { resolveFormError } from '@/services/api'

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
const turnstileToken = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

async function handleSubmit() {
  loading.value = true
  errorMessage.value = ''
  fieldErrors.value = {}

  try {
    await auth.login(email.value, password.value, turnstileToken.value)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (error) {
    const resolved = resolveFormError(error, 'Não foi possível entrar. Verifique suas credenciais.')
    fieldErrors.value = resolved.fieldErrors
    errorMessage.value = resolved.fieldErrors.turnstileToken ?? resolved.message
    turnstileToken.value = ''
    turnstileRef.value?.reset()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <form class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <BaseInput v-model="email" type="email" label="E-mail" placeholder="seu@email.com" :error="fieldErrors.email" />
      <BaseInput
        v-model="password"
        type="password"
        label="Senha"
        placeholder="••••••••"
        :error="fieldErrors.password"
      />

      <TurnstileWidget
        ref="turnstileRef"
        @verified="(token) => (turnstileToken = token)"
        @expired="turnstileToken = ''"
      />

      <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

      <BaseButton type="submit" class="w-full" :disabled="loading || !turnstileToken">
        {{ loading ? 'Entrando...' : 'Entrar' }}
      </BaseButton>
    </form>
  </AuthLayout>
</template>
