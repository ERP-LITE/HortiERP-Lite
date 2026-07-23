import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const THEME_STORAGE_KEY = 'hortierp_theme'

function getInitialTheme(): boolean {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'dark') return true
  if (stored === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(getInitialTheme())

  function applyTheme() {
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  function toggle() {
    isDark.value = !isDark.value
  }

  watch(
    isDark,
    (value) => {
      applyTheme()
      localStorage.setItem(THEME_STORAGE_KEY, value ? 'dark' : 'light')
    },
    { immediate: true },
  )

  return { isDark, toggle }
})
