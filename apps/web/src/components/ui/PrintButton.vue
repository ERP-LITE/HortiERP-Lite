<script setup lang="ts">
import { Printer } from '@lucide/vue'

function handlePrint() {
  window.print()
}
</script>

<template>
  <button
    type="button"
    class="print:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
    title="Imprimir"
    @click="handlePrint"
  >
    <Printer :size="18" />
  </button>
</template>
