<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  AlertTriangle,
  BarChart3,
  LayoutDashboard,
  Menu,
  PackagePlus,
  Ruler,
  Sprout,
  Tag,
  Users,
  Warehouse,
} from '@lucide/vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import AppUserMenu from '@/components/AppUserMenu.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(false)

const navItems = computed(() => {
  const items = [
    { name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { name: 'produtos', label: 'Produtos', icon: Sprout },
    { name: 'categorias', label: 'Categorias', icon: Tag },
    { name: 'unidades', label: 'Unidades', icon: Ruler },
    { name: 'entradas', label: 'Entradas', icon: PackagePlus },
    { name: 'estoque', label: 'Estoque', icon: Warehouse },
    { name: 'perdas', label: 'Perdas', icon: AlertTriangle },
    { name: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  ]

  if (auth.user?.role === 'admin') {
    items.push({ name: 'usuarios', label: 'Usuários', icon: Users })
  }

  return items
})

function isActive(name: string) {
  return route.name === name
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/40 z-20 lg:hidden"
      @click="sidebarOpen = false"
    />

    <aside
      class="fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <RouterLink :to="{ name: 'dashboard' }" class="flex items-center gap-2">
          <img src="/favicon.svg" alt="" class="h-8 w-8 rounded-md" />
          <span class="text-lg font-bold text-primary-700 dark:text-primary-400">HortiERP Lite</span>
        </RouterLink>
      </div>
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="
            isActive(item.name)
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          "
          @click="sidebarOpen = false"
        >
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="flex-1 flex flex-col min-w-0">
      <header
        class="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6"
      >
        <button class="lg:hidden text-gray-600 dark:text-gray-300" @click="sidebarOpen = true">
          <Menu :size="22" />
        </button>
        <div class="hidden lg:block" />
        <div class="flex items-center gap-3">
          <ThemeToggle />
          <AppUserMenu />
        </div>
      </header>

      <main class="flex-1 p-4 lg:p-6 overflow-y-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>
