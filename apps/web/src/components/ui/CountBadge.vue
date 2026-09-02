<script setup lang="ts">
withDefaults(defineProps<{ value: number; tone?: 'primary' | 'danger'; max?: number }>(), {
  tone: 'primary',
  max: 99,
})

const toneClasses: Record<string, string> = {
  primary: 'bg-primary-600',
  danger: 'bg-red-600',
}
</script>

<template>
  <span
    v-if="value > 0"
    class="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-white text-[10px] font-semibold leading-none"
    :class="toneClasses[tone]"
  >
    {{ value > max ? `${max}+` : value }}
  </span>
</template>
