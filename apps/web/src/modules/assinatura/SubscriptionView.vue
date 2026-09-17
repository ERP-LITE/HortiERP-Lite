<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CalendarClock, CreditCard } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { fetchSubscription, type Subscription } from '@/services/subscriptionService'
import { formatCurrency, formatDate } from '@/lib/format'
import { textoDoContador } from '@/lib/assinatura'

const { loading, errorMessage, withLoading } = useAsyncState()
const subscription = ref<Subscription | null>(null)

const titulo = computed(() => {
  if (!subscription.value) return 'Assinatura'
  if (subscription.value.bloqueada) return 'Seu período de teste terminou'
  if (subscription.value.status === 'teste') return 'Você está no período de teste'
  return 'Assinatura ativa'
})

onMounted(async () => {
  await withLoading(async () => {
    subscription.value = await fetchSubscription()
  })
})
</script>

<template>
  <div>
    <PageHeader title="Assinatura" subtitle="Situação do seu plano no HortiERP Lite" />

    <p v-if="errorMessage" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>
    <p v-else-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>

    <div
      v-else-if="subscription"
      class="max-w-xl rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          :class="
            subscription.bloqueada
              ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
          "
        >
          <CalendarClock :size="20" aria-hidden="true" />
        </div>
        <div class="flex-1">
          <h2 class="font-semibold text-gray-900 dark:text-gray-100">{{ titulo }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {{ textoDoContador(subscription) }}
          </p>
        </div>
      </div>

      <dl class="mt-6 space-y-3 border-t border-gray-100 pt-5 text-sm dark:border-gray-700">
        <div class="flex justify-between gap-4">
          <dt class="text-gray-500 dark:text-gray-400">Plano</dt>
          <dd class="font-medium text-gray-900 dark:text-gray-100">{{ subscription.planName ?? 'Não definido' }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-gray-500 dark:text-gray-400">Mensalidade</dt>
          <dd class="font-medium text-gray-900 dark:text-gray-100">
            {{ formatCurrency(subscription.monthlyAmount, 'Não definida') }}
          </dd>
        </div>
        <div v-if="subscription.trialEndsOn" class="flex justify-between gap-4">
          <dt class="text-gray-500 dark:text-gray-400">Teste termina em</dt>
          <dd class="font-medium text-gray-900 dark:text-gray-100">{{ formatDate(subscription.trialEndsOn) }}</dd>
        </div>
      </dl>

      <div class="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
        <p class="flex items-start gap-2">
          <CreditCard :size="18" class="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            O pagamento pelo sistema ainda não está disponível. Para assinar ou tirar dúvidas, fale com o
            suporte pelo WhatsApp do contrato e a gente libera o acesso no mesmo dia.
          </span>
        </p>
      </div>

      <BaseButton v-if="!subscription.bloqueada" class="mt-6" @click="$router.push({ name: 'dashboard' })">
        Voltar ao sistema
      </BaseButton>
    </div>
  </div>
</template>
