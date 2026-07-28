import { defineStore } from 'pinia'
import { ref } from 'vue'
import { TOKEN_STORAGE_KEY } from '@/services/api'
import { fetchMe, login as loginRequest } from '@/services/authService'
import type { AuthUser } from '@/types'

const USER_STORAGE_KEY = 'hortierp_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY))
  const user = ref<AuthUser | null>(JSON.parse(localStorage.getItem(USER_STORAGE_KEY) ?? 'null'))

  function persist(newToken: string, newUser: AuthUser) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser))
  }

  async function login(email: string, password: string, turnstileToken: string) {
    const response = await loginRequest(email, password, turnstileToken)
    persist(response.token, response.user)
  }

  async function restoreSession() {
    if (!token.value) return

    try {
      user.value = await fetchMe()
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
  }

  return {
    token,
    user,
    login,
    logout,
    restoreSession,
  }
})
