import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchMe, login as loginRequest, logout as logoutRequest } from '@/services/authService'
import type { AuthUser } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const initialized = ref(false)
  let sessionPromise: Promise<void> | null = null

  async function login(email: string, password: string, turnstileToken: string) {
    const response = await loginRequest(email, password, turnstileToken)
    user.value = response.user
    initialized.value = true
  }

  function restoreSession() {
    if (!sessionPromise) {
      sessionPromise = fetchMe()
        .then((fetchedUser) => {
          user.value = fetchedUser
        })
        .catch(() => {
          user.value = null
        })
        .finally(() => {
          initialized.value = true
        })
    }

    return sessionPromise
  }

  async function logout() {
    try {
      await logoutRequest()
    } finally {
      user.value = null
      sessionPromise = null
    }
  }

  return {
    user,
    initialized,
    login,
    logout,
    restoreSession,
  }
})
