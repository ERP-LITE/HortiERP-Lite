<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Compass } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { homeRouteName } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()

// Cortado porque o endereço vem de quem digitou: um link colado sem fim esticaria o cartão.
const enderecoTentado = computed(() =>
  route.fullPath.length > 120 ? `${route.fullPath.slice(0, 120)}...` : route.fullPath,
)

const inicio = computed(() => homeRouteName(auth.user?.role))
const rotuloDoInicio = computed(() => (inicio.value === 'selecionar-empresa' ? 'Escolher empresa' : 'Ir para o painel'))
</script>

<template>
  <div>
    <PageHeader title="Página não encontrada" subtitle="Este endereço não existe no sistema" />

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex flex-col items-center gap-4 py-8 text-center">
        <Compass :size="40" class="text-gray-400 dark:text-gray-500" />

        <div class="max-w-md">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Não há nenhuma tela em
            <span class="break-all font-mono text-xs text-gray-500 dark:text-gray-400">{{ enderecoTentado }}</span>
          </p>
          <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            O endereço pode ter sido digitado errado ou vir de um link antigo. Use o menu para chegar à tela que
            você procura.
          </p>
        </div>

        <RouterLink :to="{ name: inicio }">
          <BaseButton>{{ rotuloDoInicio }}</BaseButton>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
