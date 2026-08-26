<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useAuthStore } from '@/stores/auth'
import { resolveFormError } from '@/services/api'
import { LIMITES_TEXTO } from '@/lib/limits'

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
const invalidCredentials = ref(false)
const passwordInput = ref<{ focus: () => void } | null>(null)

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const sessionMessage = computed(() =>
  route.query.reason === 'session-ended'
    ? 'Seu acesso foi encerrado. Entre novamente ou contate o administrador.'
    : '',
)

async function handleSubmit() {
  loading.value = true
  errorMessage.value = ''
  fieldErrors.value = {}
  invalidCredentials.value = false

  try {
    await auth.login(email.value, password.value)
    const fallback = auth.user?.role === 'super_admin' ? '/selecionar-empresa' : '/'
    const redirect = (route.query.redirect as string) || fallback
    router.push(redirect)
  } catch (error) {
    const resolved = resolveFormError(error, 'Não foi possível entrar. Tente novamente.')
    fieldErrors.value = resolved.fieldErrors
    errorMessage.value = resolved.message
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      invalidCredentials.value = true
      errorMessage.value = 'E-mail ou senha incorretos.'
      await nextTick()
      passwordInput.value?.focus()
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <form class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <p v-if="sessionMessage" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
        {{ sessionMessage }}
      </p>
      <BaseInput
        v-model="email"
        type="email"
        label="E-mail"
        placeholder="seu@email.com"
        :maxlength="LIMITES_TEXTO.email"
        :error="fieldErrors.email"
        :invalid="invalidCredentials"
      />
      <BaseInput
        ref="passwordInput"
        v-model="password"
        type="password"
        label="Senha"
        placeholder="••••••••"
        :error="fieldErrors.password"
        :invalid="invalidCredentials"
      />

      <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

      <BaseButton type="submit" class="w-full" :disabled="loading">
        {{ loading ? 'Entrando...' : 'Entrar' }}
      </BaseButton>
    </form>
  </AuthLayout>
</template>
