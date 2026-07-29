import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  exitImpersonation as exitImpersonationRequest,
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
} from '@/services/authService'
import { impersonateCompany } from '@/services/companiesService'
import type { AuthUser, SessionResponse } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const impersonating = ref(false)
  const impersonatingCompanyName = ref<string | null>(null)
  const initialized = ref(false)
  let sessionPromise: Promise<void> | null = null

  function applySession(session: SessionResponse) {
    user.value = session.user
    impersonating.value = session.impersonating
    impersonatingCompanyName.value = session.impersonating ? session.companyName : null
  }

  function clearSession() {
    user.value = null
    impersonating.value = false
    impersonatingCompanyName.value = null
  }

  async function login(email: string, password: string, turnstileToken: string) {
    const response = await loginRequest(email, password, turnstileToken)
    applySession(response)
    initialized.value = true
  }

  function restoreSession() {
    if (!sessionPromise) {
      sessionPromise = fetchMe()
        .then((session) => applySession(session))
        .catch(() => {
          clearSession()
        })
        .finally(() => {
          initialized.value = true
        })
    }

    return sessionPromise
  }

  async function enterCompany(companyId: string) {
    const response = await impersonateCompany(companyId)
    applySession(response)
  }

  async function exitImpersonation() {
    const response = await exitImpersonationRequest()
    applySession(response)
  }

  async function logout() {
    try {
      await logoutRequest()
    } finally {
      clearSession()
      sessionPromise = null
    }
  }

  return {
    user,
    impersonating,
    impersonatingCompanyName,
    initialized,
    login,
    enterCompany,
    exitImpersonation,
    logout,
    restoreSession,
  }
})
