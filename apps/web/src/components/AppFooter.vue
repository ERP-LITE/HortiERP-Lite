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
    class="shrink-0 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-4 py-3 text-xs text-gray-500 dark:text-gray-400 lg:px-6"
  >
    <RouterLink
      :to="{ name: 'privacidade' }"
      class="hover:text-gray-700 hover:underline dark:hover:text-gray-200"
    >
      Aviso de privacidade
    </RouterLink>
    <span aria-hidden="true" class="text-gray-300 dark:text-gray-700">·</span>
    <span>&copy; {{ currentYear }} HortiERP Lite. Todos os direitos reservados.</span>
  </footer>
</template>
