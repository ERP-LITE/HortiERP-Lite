<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import GlobalRequestIndicator from '@/components/ui/GlobalRequestIndicator.vue'

const route = useRoute()
const isPublic = computed(() => route.meta.public === true)
</script>

<template>
  <GlobalRequestIndicator />
  <AppLayout v-if="!isPublic" />
  <RouterView v-else />
</template>
