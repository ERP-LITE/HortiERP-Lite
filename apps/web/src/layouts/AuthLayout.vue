<script setup lang="ts">
import { Sprout, Apple, Carrot, Grape, Citrus, LeafyGreen, Banana } from '@lucide/vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-gray-950 dark:via-gray-950 dark:to-[#052e16]"
  >
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <Apple class="absolute -top-10 -left-10 h-56 w-56 text-primary-600/10 dark:text-primary-400/10 -rotate-12" />
      <Carrot class="absolute top-1/4 -right-16 h-64 w-64 text-primary-600/10 dark:text-primary-400/10 rotate-12" />
      <Grape class="absolute -bottom-16 -left-8 h-64 w-64 text-primary-600/10 dark:text-primary-400/10 rotate-6" />
      <Citrus class="absolute bottom-10 right-10 h-40 w-40 text-primary-600/10 dark:text-primary-400/10 -rotate-6" />
      <LeafyGreen class="absolute top-10 left-1/3 h-32 w-32 text-primary-600/10 dark:text-primary-400/10 rotate-12" />
      <Banana class="absolute bottom-1/3 right-1/4 h-32 w-32 text-primary-600/10 dark:text-primary-400/10 -rotate-12" />
    </div>

    <div class="absolute top-4 right-4 z-10">
      <ThemeToggle />
    </div>

    <div class="w-full max-w-sm relative z-10">
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary-600 text-white mb-3 shadow-lg shadow-primary-600/20"
        >
          <Sprout :size="24" />
        </div>
        <h1 class="text-2xl font-bold text-primary-700 dark:text-primary-400">HortiERP Lite</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Controle de estoque para hortifrutis</p>
      </div>
      <div
        class="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-6"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
