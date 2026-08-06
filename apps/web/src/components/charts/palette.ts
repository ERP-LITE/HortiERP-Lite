import { useThemeStore } from '@/stores/theme'

const CATEGORICAL_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const CATEGORICAL_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export const STATUS_GOOD = '#0ca30c'
export const STATUS_CRITICAL = '#d03b3b'
export const STATUS_NEUTRAL = '#64748b'

export function useCategoricalPalette() {
  const theme = useThemeStore()
  return theme.isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT
}

export function useChartInk() {
  const theme = useThemeStore()
  return {
    secondary: theme.isDark ? '#c3c2b7' : '#52514e',
    muted: '#898781',
    grid: theme.isDark ? '#2c2c2a' : '#e1e0d9',
    axis: theme.isDark ? '#383835' : '#c3c2b7',
  }
}
