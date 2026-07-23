<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { getApiErrorMessage } from '@/services/api'
import { listCurrentStock } from '@/services/stockService'
import type { ProductWithRelations } from '@/types'

const products = ref<ProductWithRelations[]>([])
const loading = ref(true)
const errorMessage = ref('')

async function loadStock() {
  loading.value = true
  try {
    products.value = await listCurrentStock()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(loadStock)
</script>

<template>
  <div>
    <PageHeader title="Estoque atual" subtitle="Situação de estoque por produto">
      <template #actions>
        <RouterLink :to="{ name: 'movimentacoes' }" class="text-sm text-primary-600 hover:underline">
          Ver histórico de movimentações →
        </RouterLink>
      </template>
    </PageHeader>

    <p v-if="errorMessage" class="text-sm text-red-600 mb-4">{{ errorMessage }}</p>

    <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque atual</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque mínimo</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500">Carregando...</td>
          </tr>
          <tr v-else-if="products.length === 0">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500">Nenhum produto cadastrado.</td>
          </tr>
          <tr v-for="product in products" v-else :key="product.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{{ product.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{{ product.category?.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
              {{ Number(product.currentStock) }} {{ product.unit?.abbreviation }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
              {{ Number(product.minStock) }} {{ product.unit?.abbreviation }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <BaseBadge v-if="Number(product.currentStock) <= Number(product.minStock)" variant="warning">
                Estoque baixo
              </BaseBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
