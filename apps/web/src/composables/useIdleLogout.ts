import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const WARNING_BEFORE_MS = 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const
const ACTIVITY_THROTTLE_MS = 1000

export function useIdleLogout() {
  const auth = useAuthStore()
  const showWarning = ref(false)
  const secondsLeft = ref(0)

  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let warningTimer: ReturnType<typeof setTimeout> | undefined
  let countdownInterval: ReturnType<typeof setInterval> | undefined
  let lastActivityReset = 0

  function clearTimers() {
    clearTimeout(idleTimer)
    clearTimeout(warningTimer)
    clearInterval(countdownInterval)
  }

  function startWarningCountdown() {
    showWarning.value = true
    secondsLeft.value = Math.round(WARNING_BEFORE_MS / 1000)

    countdownInterval = setInterval(() => {
      secondsLeft.value -= 1
      if (secondsLeft.value <= 0) clearInterval(countdownInterval)
    }, 1000)
  }

  async function handleTimeout() {
    clearTimers()
    showWarning.value = false
    await auth.logout()
    window.location.href = '/login'
  }

  function scheduleTimers() {
    clearTimers()
    warningTimer = setTimeout(startWarningCountdown, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS)
    idleTimer = setTimeout(handleTimeout, IDLE_TIMEOUT_MS)
  }

  // Once the warning is showing, only an explicit "continuar conectado" click
  // (via stayLoggedIn) counts as presence — incidental mouse jiggle shouldn't
  // silently dismiss it.
  function handleActivity() {
    if (showWarning.value) return

    const now = Date.now()
    if (now - lastActivityReset < ACTIVITY_THROTTLE_MS) return
    lastActivityReset = now

    scheduleTimers()
  }

  function stayLoggedIn() {
    showWarning.value = false
    scheduleTimers()
  }

  onMounted(() => {
    scheduleTimers()
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }))
  })

  onBeforeUnmount(() => {
    clearTimers()
    ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity))
  })

  return { showWarning, secondsLeft, stayLoggedIn }
}
