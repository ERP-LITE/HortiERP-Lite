<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const currentYear = ref(new Date().getFullYear())
const yearCheckInterval = window.setInterval(() => {
  currentYear.value = new Date().getFullYear()
}, 60 * 60 * 1000)

onBeforeUnmount(() => window.clearInterval(yearCheckInterval))
</script>

<template>
  <footer
    class="shrink-0 px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400 lg:px-6"
  >
    &copy; {{ currentYear }} HortiERP Lite. Todos os direitos reservados.
  </footer>
</template>
