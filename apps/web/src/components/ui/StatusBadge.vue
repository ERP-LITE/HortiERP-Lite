<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from './BaseBadge.vue'
import { statusLabel, type Genero } from '@/lib/status'

const props = withDefaults(
  defineProps<{
    active: boolean
    genero?: Genero
    inactiveText?: string
  }>(),
  { genero: 'm' },
)

const texto = computed(() =>
  props.active ? statusLabel(true, props.genero) : props.inactiveText ?? statusLabel(false, props.genero),
)
</script>

<template>
  <BaseBadge :variant="active ? 'success' : 'neutral'">{{ texto }}</BaseBadge>
</template>
