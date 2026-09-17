<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CalendarClock } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { fetchSubscription, type Subscription } from '@/services/subscriptionService'
import { textoDoContador } from '@/lib/assinatura'

const auth = useAuthStore()
const assinatura = ref<Subscription | null>(null)

const visivel = computed(() => assinatura.value?.status === 'teste')

/** Nos últimos três dias a faixa fica âmbar, para o aviso mudar de peso antes de virar bloqueio. */
const acabando = computed(() => (assinatura.value?.diasRestantes ?? 99) <= 3)

onMounted(async () => {
  // O super admin não assina nada, e no suporte a faixa falaria da empresa visitada.
  if (auth.user?.role === 'super_admin' || auth.impersonating) return

  try {
    assinatura.value = await fetchSubscription()
  } catch {
    // Sem a faixa a pessoa continua trabalhando: quem barra o acesso vencido é a API, não este aviso.
  }
})
</script>

<template>
  <div
    v-if="visivel"
    class="print:hidden flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b px-4 py-2 text-sm sm:flex-nowrap lg:px-6"
    :class="
      acabando
        ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
        : 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary-200'
    "
  >
    <CalendarClock :size="16" class="shrink-0" aria-hidden="true" />
    <span>{{ textoDoContador(assinatura!) }}</span>
    <RouterLink :to="{ name: 'assinatura' }" class="font-medium underline underline-offset-2">
      Ver assinatura
    </RouterLink>
  </div>
</template>
