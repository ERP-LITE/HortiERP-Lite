<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
    :title="theme.isDark ? 'Ativar modo claro' : 'Ativar modo escuro'"
    @click="theme.toggle"
  >
    <Sun v-if="theme.isDark" :size="18" />
    <Moon v-else :size="18" />
  </button>
</template>
