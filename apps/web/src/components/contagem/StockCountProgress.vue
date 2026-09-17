<script setup lang="ts">
import { computed } from 'vue'
import { progressoDaContagem, textoDoProgresso } from '@/lib/stockCount'

const props = defineProps<{ counted: number; total: number; compact?: boolean }>()

const percent = computed(() => progressoDaContagem(props.counted, props.total))
const texto = computed(() => textoDoProgresso(props.counted, props.total))
</script>

<template>
  <div class="min-w-0">
    <div
      class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="texto"
    >
      <div class="h-full rounded-full bg-primary-600 transition-all dark:bg-primary-500" :style="{ width: `${percent}%` }" />
    </div>
    <p v-if="!compact" class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ texto }}</p>
  </div>
</template>
