<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { getApiErrorMessage } from '@/services/api'
import { fetchDashboardSummary } from '@/services/dashboardService'
import type { DashboardSummary, MovementType } from '@/types'

const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const errorMessage = ref('')

const typeLabels: Record<MovementType, string> = {
  entrada: 'Entrada',
  perda: 'Perda',
  ajuste: 'Ajuste',
}

const typeVariant: Record<MovementType, 'success' | 'danger' | 'neutral'> = {
  entrada: 'success',
  perda: 'danger',
  ajuste: 'neutral',
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR')
}

async function loadSummary() {
  loading.value = true
  try {
    summary.value = await fetchDashboardSummary()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(loadSummary)
</script>

<template>
  <div>
    <PageHeader title="Dashboard" subtitle="Visão geral do estoque" />

    <p v-if="errorMessage" class="text-sm text-red-600 mb-4">{{ errorMessage }}</p>
    <p v-else-if="loading" class="text-sm text-gray-500">Carregando...</p>

    <template v-else-if="summary">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Produtos ativos" :value="String(summary.totalProducts)" />
        <StatCard
          label="Produtos com estoque baixo"
          :value="String(summary.lowStockCount)"
          :tone="summary.lowStockCount > 0 ? 'warning' : 'default'"
        />
        <StatCard label="Valor de estoque (custo)" :value="formatCurrency(summary.stockValue)" />
        <StatCard
          label="Perdas (últimos 30 dias)"
          :value="`${summary.last30Days.lossesQuantity} un. / ${summary.last30Days.lossesCount} registros`"
          tone="danger"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200">
            <h2 class="text-sm font-semibold text-gray-700">Produtos com estoque baixo</h2>
          </div>
          <table class="min-w-full divide-y divide-gray-100">
            <tbody class="divide-y divide-gray-100">
              <tr v-if="summary.lowStockProducts.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 text-center">Nenhum produto abaixo do mínimo.</td>
              </tr>
              <tr v-for="product in summary.lowStockProducts" v-else :key="product.id">
                <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ product.name }}</td>
                <td class="px-4 py-3 text-sm text-gray-500 text-right whitespace-nowrap">
                  {{ Number(product.currentStock) }} / mín. {{ Number(product.minStock) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200">
            <h2 class="text-sm font-semibold text-gray-700">Movimentações recentes</h2>
          </div>
          <table class="min-w-full divide-y divide-gray-100">
            <tbody class="divide-y divide-gray-100">
              <tr v-if="summary.recentMovements.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 text-center">Nenhuma movimentação registrada.</td>
              </tr>
              <tr v-for="movement in summary.recentMovements" v-else :key="movement.id">
                <td class="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{{ movement.product?.name }}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <BaseBadge :variant="typeVariant[movement.type]">{{ typeLabels[movement.type] }}</BaseBadge>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500 text-right whitespace-nowrap">
                  {{ formatDateTime(movement.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
