import { onBeforeUnmount, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const SESSION_CHECK_INTERVAL_MS = 45 * 1000
const FOCUS_CHECK_THROTTLE_MS = 5 * 1000

export function useSessionMonitor() {
  const auth = useAuthStore()
  let interval: ReturnType<typeof setInterval> | undefined
  let checking = false
  let lastCheckAt = 0

  async function checkSession() {
    if (checking || document.visibilityState === 'hidden') return
    const now = Date.now()
    if (now - lastCheckAt < FOCUS_CHECK_THROTTLE_MS) return

    checking = true
    lastCheckAt = now
    try {
      await auth.validateSession()
    } catch {
    } finally {
      checking = false
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') void checkSession()
  }

  onMounted(() => {
    interval = setInterval(() => void checkSession(), SESSION_CHECK_INTERVAL_MS)
    window.addEventListener('focus', checkSession)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    clearInterval(interval)
    window.removeEventListener('focus', checkSession)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })
}
