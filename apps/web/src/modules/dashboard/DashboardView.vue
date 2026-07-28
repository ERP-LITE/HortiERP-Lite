<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, Coins, Package, TrendingDown } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FilterButton from '@/components/ui/FilterButton.vue'
import PrintButton from '@/components/ui/PrintButton.vue'
import PeriodPicker from '@/components/ui/PeriodPicker.vue'
import { rangeForPreset, type PeriodValue } from '@/lib/period'
import DonutChart from '@/components/charts/DonutChart.vue'
import MovementsTrendChart from '@/components/charts/MovementsTrendChart.vue'
import LossesByReasonChart from '@/components/charts/LossesByReasonChart.vue'
import { getApiErrorMessage } from '@/services/api'
import { fetchDashboardSummary } from '@/services/dashboardService'
import type { DashboardSummary, MovementType } from '@/types'

function defaultPeriod(): PeriodValue {
  return { preset: '30dias', ...rangeForPreset('30dias') }
}

const period = ref<PeriodValue>(defaultPeriod())
const draftPeriod = ref<PeriodValue>({ ...period.value })
const filterModalOpen = ref(false)
const activeFilterCount = computed(() => (period.value.preset === '30dias' ? 0 : 1))

const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const errorMessage = ref('')

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

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
    summary.value = await fetchDashboardSummary({ from: period.value.from || undefined, to: period.value.to || undefined })
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openFilterModal() {
  draftPeriod.value = { ...period.value }
  filterModalOpen.value = true
}

function applyFilters() {
  period.value = { ...draftPeriod.value }
  filterModalOpen.value = false
  loadSummary()
}

function clearFilters() {
  period.value = defaultPeriod()
  draftPeriod.value = { ...period.value }
  filterModalOpen.value = false
  loadSummary()
}

onMounted(loadSummary)
</script>

<template>
  <div>
    <PageHeader title="Dashboard" subtitle="Visão geral do estoque">
      <template #actions>
        <FilterButton :active="activeFilterCount" @click="openFilterModal" />
        <PrintButton />
      </template>
    </PageHeader>

    <p v-if="summary" class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      Período: {{ formatDate(summary.periodFrom) }} até {{ formatDate(summary.periodTo) }}
    </p>

    <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ errorMessage }}</p>
    <p v-else-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>

    <template v-else-if="summary">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Produtos ativos" :value="String(summary.totalProducts)" :icon="Package" />
        <StatCard
          label="Produtos com estoque baixo"
          :value="String(summary.lowStockCount)"
          :tone="summary.lowStockCount > 0 ? 'warning' : 'default'"
          :icon="AlertTriangle"
        />
        <StatCard label="Valor de estoque (custo)" :value="formatCurrency(summary.stockValue)" :icon="Coins" />
        <StatCard
          label="Perdas no período"
          :value="`${summary.lossesInPeriod.lossesQuantity} un. / ${summary.lossesInPeriod.lossesCount} registros`"
          tone="danger"
          :icon="TrendingDown"
        />
      </div>

      <div class="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div
          class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Movimentações no período
            </h2>
          </div>
          <div class="p-4">
            <MovementsTrendChart :data="summary.movementsTimeline" />
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Estoque por categoria</h2>
          </div>
          <div class="p-4">
            <DonutChart
              :data="summary.stockByCategory.map((c) => ({ label: c.categoryName, value: c.totalStock }))"
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="print:hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Perdas por motivo no período
            </h2>
          </div>
          <div class="p-4">
            <LossesByReasonChart :data="summary.lossesByReason" />
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Produtos com estoque baixo</h2>
          </div>
          <table class="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="summary.lowStockProducts.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Nenhum produto abaixo do mínimo.
                </td>
              </tr>
              <tr v-for="product in summary.lowStockProducts" v-else :key="product.id">
                <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ product.name }}</td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">
                  {{ Number(product.currentStock) }} / mín. {{ Number(product.minStock) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Movimentações recentes</h2>
          </div>
          <table class="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="summary.recentMovements.length === 0">
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Nenhuma movimentação registrada.
                </td>
              </tr>
              <tr v-for="movement in summary.recentMovements" v-else :key="movement.id">
                <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {{ movement.product?.name }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <BaseBadge :variant="typeVariant[movement.type]">{{ typeLabels[movement.type] }}</BaseBadge>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">
                  {{ formatDateTime(movement.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <BaseModal :open="filterModalOpen" title="Filtrar por período" @close="filterModalOpen = false">
      <form class="space-y-4" @submit.prevent="applyFilters">
        <PeriodPicker v-model="draftPeriod" :include-all-time="false" />

        <div class="flex justify-between items-center pt-2">
          <button type="button" class="text-sm text-gray-500 hover:underline dark:text-gray-400" @click="clearFilters">
            Limpar
          </button>
          <div class="flex gap-2">
            <BaseButton variant="secondary" type="button" @click="filterModalOpen = false">Cancelar</BaseButton>
            <BaseButton type="submit">Aplicar</BaseButton>
          </div>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
