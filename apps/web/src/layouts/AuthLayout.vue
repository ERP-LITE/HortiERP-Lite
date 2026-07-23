<script setup lang="ts">
//
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-primary-700">HortiERP Lite</h1>
        <p class="text-sm text-gray-500 mt-1">Controle de estoque para hortifrutis</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <slot />
      </div>
    </div>
  </div>
</template>
