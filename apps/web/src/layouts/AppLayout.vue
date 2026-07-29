<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Ruler,
  Sprout,
  Store,
  Tag,
  Users,
  Warehouse,
} from '@lucide/vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import AppUserMenu from '@/components/AppUserMenu.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useIdleLogout } from '@/composables/useIdleLogout'
import { getApiErrorMessage } from '@/services/api'
import { toastError } from '@/lib/alerts'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)
const exitingImpersonation = ref(false)
const { showWarning, secondsLeft, stayLoggedIn } = useIdleLogout()

async function handleExitImpersonation() {
  exitingImpersonation.value = true
  try {
    await auth.exitImpersonation()
    router.push({ name: 'selecionar-empresa' })
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível voltar ao painel de super admin'))
  } finally {
    exitingImpersonation.value = false
  }
}

const navItems = computed(() => {
  if (auth.user?.role === 'super_admin') {
    return [
      { name: 'selecionar-empresa', label: 'Selecionar empresa', icon: Store },
      { name: 'empresas', label: 'Configurações', icon: Building2 },
    ]
  }

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

const homeRoute = computed(() => (auth.user?.role === 'super_admin' ? 'selecionar-empresa' : 'dashboard'))

function isActive(name: string) {
  return route.name === name
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex print:block print:min-h-0">
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/40 z-20 lg:hidden"
      @click="sidebarOpen = false"
    />

    <aside
      class="print:hidden fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <RouterLink :to="{ name: homeRoute }" class="flex items-center gap-2">
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

    <div class="flex-1 flex flex-col min-w-0 print:block">
      <div
        v-if="auth.impersonating"
        class="print:hidden flex items-center justify-between gap-3 px-4 lg:px-6 py-2 bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm"
      >
        <span>Você está acessando como suporte em <strong>{{ auth.impersonatingCompanyName }}</strong></span>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 font-medium hover:underline disabled:opacity-60"
          :disabled="exitingImpersonation"
          @click="handleExitImpersonation"
        >
          <LogOut :size="14" />
          {{ exitingImpersonation ? 'Saindo...' : 'Voltar ao super admin' }}
        </button>
      </div>
      <header
        class="print:hidden h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6"
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

      <main class="flex-1 p-4 lg:p-6 overflow-y-auto print:overflow-visible print:h-auto print:p-0">
        <RouterView />
      </main>
    </div>

    <BaseModal :open="showWarning" title="Sessão prestes a expirar" @close="stayLoggedIn">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Você ficou inativo por um tempo. Por segurança, sua sessão vai encerrar em
        <strong>{{ secondsLeft }}s</strong> se não houver interação.
      </p>
      <div class="mt-6 flex justify-end">
        <BaseButton @click="stayLoggedIn">Continuar conectado</BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
