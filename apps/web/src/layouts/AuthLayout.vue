<script setup lang="ts">
import { Sprout } from '@lucide/vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 relative">
    <div class="absolute top-4 right-4">
      <ThemeToggle />
    </div>

    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary-600 text-white mb-3"
        >
          <Sprout :size="24" />
        </div>
        <h1 class="text-2xl font-bold text-primary-700 dark:text-primary-400">HortiERP Lite</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Controle de estoque para hortifrutis</p>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <slot />
      </div>
    </div>
  </div>
</template>
