<script setup lang="ts">
import { Printer } from '@lucide/vue'

function handlePrint() {
  window.print()
}
</script>

<template>
  <button
    type="button"
    class="print:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    title="Imprimir"
    @click="handlePrint"
  >
    <Printer :size="18" />
  </button>
</template>
