<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, Settings, Store } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { getApiErrorMessage } from '@/services/api'
import { toastError } from '@/lib/alerts'
import { listAllCompanies } from '@/services/companiesService'
import { useAuthStore } from '@/stores/auth'
import type { Company } from '@/types'

const auth = useAuthStore()
const router = useRouter()

const companies = ref<Company[]>([])
const loading = ref(true)
const entering = ref<string | null>(null)

async function loadCompanies() {
  loading.value = true
  try {
    companies.value = await listAllCompanies()
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível carregar as empresas'))
  } finally {
    loading.value = false
  }
}

async function enterCompany(company: Company) {
  if (!company.active || entering.value) return

  entering.value = company.id
  try {
    await auth.enterCompany(company.id)
    router.push({ name: 'dashboard' })
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível acessar essa empresa'))
  } finally {
    entering.value = null
  }
}

onMounted(loadCompanies)
</script>

<template>
  <div>
    <PageHeader title="Selecionar empresa" subtitle="Escolha uma empresa para acessar ou vá para as configurações gerais" />

    <div class="max-w-lg space-y-2">
      <p v-if="loading" class="text-sm text-gray-500 dark:text-gray-400 px-1">Carregando...</p>
      <button
        v-for="company in companies"
        v-else
        :key="company.id"
        type="button"
        class="w-full flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5 text-left transition-colors"
        :class="
          company.active
            ? 'hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer'
            : 'opacity-50 cursor-not-allowed'
        "
        :disabled="!company.active || !!entering"
        @click="enterCompany(company)"
      >
        <div class="flex items-center gap-3">
          <Store :size="18" class="text-primary-600 dark:text-primary-400 shrink-0" />
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ company.name }}</span>
          <BaseBadge v-if="!company.active" variant="neutral">Suspensa</BaseBadge>
        </div>
        <span class="text-xs text-gray-400">{{ entering === company.id ? 'Entrando...' : '' }}</span>
        <ChevronRight v-if="company.active" :size="16" class="text-gray-400 shrink-0" />
      </button>

      <RouterLink
        :to="{ name: 'empresas' }"
        class="w-full flex items-center gap-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors mt-4"
      >
        <Settings :size="18" class="text-gray-500 dark:text-gray-400 shrink-0" />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Configurações gerais do sistema</span>
      </RouterLink>
    </div>
  </div>
</template>
