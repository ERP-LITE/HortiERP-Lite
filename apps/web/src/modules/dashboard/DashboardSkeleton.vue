<template>
  <div class="animate-pulse" aria-label="Carregando dashboard" aria-busy="true">
    <div class="mb-4 h-4 w-56 rounded bg-gray-200 dark:bg-gray-700" />

    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="item in 4" :key="item" class="h-28 rounded-xl bg-gray-200 dark:bg-gray-700" />
    </div>

    <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="h-80 rounded-xl bg-gray-200 dark:bg-gray-700 lg:col-span-2" />
      <div class="h-80 rounded-xl bg-gray-200 dark:bg-gray-700" />
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div v-for="item in 3" :key="item" class="h-72 rounded-xl bg-gray-200 dark:bg-gray-700" />
    </div>
  </div>
</template>
