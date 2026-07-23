<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(false)

const navItems = computed(() => {
  const items = [
    { name: 'dashboard', label: 'Dashboard', icon: '📊' },
    { name: 'produtos', label: 'Produtos', icon: '🥦' },
    { name: 'categorias', label: 'Categorias', icon: '🏷️' },
    { name: 'unidades', label: 'Unidades', icon: '📏' },
    { name: 'entradas', label: 'Entradas', icon: '📥' },
    { name: 'estoque', label: 'Estoque', icon: '📦' },
    { name: 'perdas', label: 'Perdas', icon: '⚠️' },
    { name: 'relatorios', label: 'Relatórios', icon: '📈' },
  ]

  if (auth.user?.role === 'admin') {
    items.push({ name: 'usuarios', label: 'Usuários', icon: '👤' })
  }

  return items
})

function isActive(name: string) {
  return route.name === name
}

function handleLogout() {
  auth.logout()
  window.location.href = '/login'
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex">
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/40 z-20 lg:hidden"
      @click="sidebarOpen = false"
    />

    <aside
      class="fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-16 flex items-center px-6 border-b border-gray-200">
        <span class="text-lg font-bold text-primary-700">HortiERP Lite</span>
      </div>
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="
            isActive(item.name)
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-600 hover:bg-gray-100'
          "
          @click="sidebarOpen = false"
        >
          <span>{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
        <button class="lg:hidden text-gray-600" @click="sidebarOpen = true">
          ☰
        </button>
        <div class="hidden lg:block" />
        <div class="flex items-center gap-4">
          <div class="text-right">
            <p class="text-sm font-medium text-gray-900">{{ auth.user?.name }}</p>
            <p class="text-xs text-gray-500 capitalize">{{ auth.user?.role }}</p>
          </div>
          <button
            class="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
            @click="handleLogout"
          >
            Sair
          </button>
        </div>
      </header>

      <main class="flex-1 p-4 lg:p-6 overflow-y-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>
