<script setup lang="ts">
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { stockCountStatusLabels, stockCountStatusVariants } from '@/lib/stockCount'
import type { StockCountStatus } from '@/types'

defineProps<{ status: StockCountStatus }>()
</script>

<template>
  <BaseBadge :variant="stockCountStatusVariants[status]">{{ stockCountStatusLabels[status] }}</BaseBadge>
</template>
