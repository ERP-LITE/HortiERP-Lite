<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, LogOut, User } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  operador: 'Operador',
}

function initials(name?: string) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function toggle() {
  open.value = !open.value
}

function handleClickOutside(event: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    open.value = false
  }
}

async function handleLogout() {
  try {
    await auth.logout()
  } finally {
    window.location.replace('/login')
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      @click="toggle"
    >
      <span
        class="h-8 w-8 shrink-0 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-semibold"
      >
        {{ initials(auth.user?.name) }}
      </span>
      <span class="hidden sm:block text-left leading-tight">
        <span class="block text-sm font-medium text-gray-900 dark:text-gray-100">{{ auth.user?.name }}</span>
        <span class="block text-xs text-gray-500 dark:text-gray-400">
          {{ roleLabels[auth.user?.role ?? ''] ?? auth.user?.role }}
        </span>
      </span>
      <ChevronDown :size="16" class="text-gray-400 dark:text-gray-500" />
    </button>

    <div
      v-if="open"
      class="absolute right-0 mt-2 w-60 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-2 z-50"
    >
      <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ auth.user?.name }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ auth.user?.email }}</p>
        <span
          class="inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
        >
          {{ roleLabels[auth.user?.role ?? ''] ?? auth.user?.role }}
        </span>
      </div>
      <RouterLink
        :to="{ name: 'perfil' }"
        class="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        @click="open = false"
      >
        <User :size="16" /> Perfil
      </RouterLink>
      <button
        type="button"
        class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
        @click="handleLogout"
      >
        <LogOut :size="16" /> Sair
      </button>
    </div>
  </div>
</template>
