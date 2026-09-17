<script setup lang="ts">
import StatCard from '@/components/ui/StatCard.vue'
import { formatCurrency } from '@/lib/format'
import type { StockCountTotals } from '@/types'

const props = defineProps<{ resumo: StockCountTotals }>()

function tomDoSaldo() {
  if (props.resumo.netValue < 0) return 'danger' as const
  if (props.resumo.netValue > 0) return 'warning' as const
  return 'default' as const
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard
      label="Produtos contados"
      :value="`${resumo.countedCount} de ${resumo.itemsCount}`"
      :supporting-text="resumo.pendingCount > 0 ? `${resumo.pendingCount} sem contar` : 'Nenhum produto ficou de fora'"
    />
    <StatCard
      label="Produtos com divergência"
      :value="String(resumo.divergentCount)"
      :tone="resumo.divergentCount > 0 ? 'warning' : 'default'"
      supporting-text="Contagem diferente do que o sistema tinha"
    />
    <StatCard
      label="Faltou"
      :value="formatCurrency(resumo.negativeValue)"
      :tone="resumo.negativeValue > 0 ? 'danger' : 'default'"
      supporting-text="Mercadoria que sumiu sem registro"
    />
    <StatCard
      label="Saldo da contagem"
      :value="formatCurrency(resumo.netValue)"
      :tone="tomDoSaldo()"
      :supporting-text="`Sobra de ${formatCurrency(resumo.positiveValue)} menos a falta`"
    />
  </div>
</template>
