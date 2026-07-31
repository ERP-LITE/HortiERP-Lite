<script setup lang="ts">
import { X } from '@lucide/vue'

defineProps<{ open: boolean; title: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40" @click="$emit('close')" />
      <div
        class="app-modal-scrollbar relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-lg dark:bg-gray-800"
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h2>
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none"
            @click="$emit('close')"
          >
            <X :size="20" />
          </button>
        </div>
        <div class="p-6">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
