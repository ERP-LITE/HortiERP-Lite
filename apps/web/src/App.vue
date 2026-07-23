<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const isPublic = computed(() => route.meta.public === true)

onMounted(() => {
  auth.restoreSession()
})
</script>

<template>
  <AppLayout v-if="!isPublic" />
  <RouterView v-else />
</template>
