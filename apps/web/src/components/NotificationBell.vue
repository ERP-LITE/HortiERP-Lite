<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import { Bell, PackageX, TrendingDown, WalletCards } from '@lucide/vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import CountBadge from '@/components/ui/CountBadge.vue'
import { useNotifications } from '@/composables/useNotifications'
import { useDropdown } from '@/composables/useDropdown'
import { formatCurrency, formatDateOnly, formatQuantity } from '@/lib/format'

const { operational, billing, total, isPlataforma, indisponivel, refresh } = useNotifications()

const botao = ref<HTMLElement | null>(null)
const estiloDoPainel = ref<CSSProperties>({})

const MARGEM = 16
const ESPACO_ABAIXO_DO_BOTAO = 8
const LARGURA_MAXIMA = 384
const ALTURA_MAXIMA = 480

/**
 * O painel é preso à janela, não ao botão. No cabeçalho o sino não é o último elemento — ainda
 * vêm o seletor de tema e o menu do usuário — então alinhar a direita do painel com a direita do
 * botão jogava a largura inteira para fora da tela pela esquerda no celular. Mesmo tratamento que
 * o calendário do `DateInput` recebe.
 */
function posicionarPainel() {
  if (!botao.value) return
  const gatilho = botao.value.getBoundingClientRect()
  const largura = Math.min(LARGURA_MAXIMA, window.innerWidth - 2 * MARGEM)
  const esquerda = Math.max(MARGEM, Math.min(gatilho.right - largura, window.innerWidth - largura - MARGEM))
  const topo = gatilho.bottom + ESPACO_ABAIXO_DO_BOTAO

  estiloDoPainel.value = {
    left: `${esquerda}px`,
    top: `${topo}px`,
    width: `${largura}px`,
    // A altura sai do espaço que sobra abaixo do botão, e não de um teto fixo: a faixa da
    // impersonação muda de altura conforme o nome da empresa quebra em duas linhas.
    maxHeight: `${Math.min(ALTURA_MAXIMA, window.innerHeight - topo - MARGEM)}px`,
  }
}

const { open, rootRef, toggle, close } = useDropdown({
  // Abrir o painel mede o botão e puxa dado fresco: quem clica no sino quer conferir agora.
  onOpen: () => {
    posicionarPainel()
    void refresh(true)
  },
  onReposition: posicionarPainel,
})

const tituloDoBotao = computed(() => {
  if (total.value === 0) return 'Alertas: nada pendente'
  return total.value === 1 ? '1 alerta' : `${total.value} alertas`
})

const semMinimo = computed(() => operational.value?.withoutMinStockCount ?? 0)
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      ref="botao"
      type="button"
      class="relative inline-flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
      :title="tituloDoBotao"
      :aria-label="tituloDoBotao"
      @click="toggle"
    >
      <Bell :size="18" />
      <CountBadge :value="total" tone="danger" />
    </button>

    <div
      v-if="open"
      :style="estiloDoPainel"
      class="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
    >
      <div class="shrink-0 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Alertas</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ isPlataforma ? 'Situação das cobranças das empresas-cliente' : 'Situação atual do seu estoque' }}
        </p>
      </div>

      <div class="min-h-0 overflow-y-auto">
        <p v-if="indisponivel" class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
          Não foi possível consultar os alertas agora. A verificação se repete em alguns minutos.
        </p>

        <template v-else-if="isPlataforma">
          <p v-if="!billing || billing.total === 0" class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
            Nenhuma cobrança atrasada.
          </p>
          <div v-else class="py-2">
            <div class="flex items-start gap-2 px-4 py-2">
              <WalletCards :size="16" class="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              <p class="text-sm text-gray-700 dark:text-gray-200">
                <strong>{{ billing.overdueCount }}</strong>
                {{ billing.overdueCount === 1 ? 'cobrança atrasada' : 'cobranças atrasadas' }},
                somando {{ formatCurrency(billing.overdueValue) }}
              </p>
            </div>
            <ul class="mt-1 border-t border-gray-100 dark:border-gray-700">
              <li
                v-for="item in billing.billings"
                :key="item.id"
                class="px-4 py-2 border-b border-gray-100 last:border-b-0 dark:border-gray-700"
              >
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{{ item.companyName }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Venceu em {{ formatDateOnly(item.dueDate) }} · {{ formatCurrency(item.amount) }}
                </p>
              </li>
            </ul>
          </div>
        </template>

        <template v-else>
          <p
            v-if="!operational || (operational.total === 0 && operational.lossesToday.count === 0 && semMinimo === 0)"
            class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400"
          >
            Nenhum alerta no momento.
          </p>

          <div v-else class="py-2">
            <div v-if="operational.outOfStockCount > 0" class="flex items-start gap-2 px-4 py-2">
              <PackageX :size="16" class="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              <p class="text-sm text-gray-700 dark:text-gray-200">
                <strong>{{ operational.outOfStockCount }}</strong>
                {{ operational.outOfStockCount === 1 ? 'produto sem estoque' : 'produtos sem estoque' }}
              </p>
            </div>
            <div v-if="operational.lowStockCount > 0" class="flex items-start gap-2 px-4 py-2">
              <TrendingDown :size="16" class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p class="text-sm text-gray-700 dark:text-gray-200">
                <strong>{{ operational.lowStockCount }}</strong>
                {{ operational.lowStockCount === 1 ? 'produto abaixo do mínimo' : 'produtos abaixo do mínimo' }}
              </p>
            </div>

            <ul v-if="operational.products.length > 0" class="mt-1 border-t border-gray-100 dark:border-gray-700">
              <li
                v-for="product in operational.products"
                :key="product.id"
                class="px-4 py-2 border-b border-gray-100 last:border-b-0 dark:border-gray-700"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{{ product.name }}</p>
                  <BaseBadge
                    class="shrink-0 whitespace-nowrap"
                    :variant="product.status === 'sem_estoque' ? 'danger' : 'warning'"
                  >
                    {{ product.status === 'sem_estoque' ? 'Sem estoque' : 'Abaixo do mínimo' }}
                  </BaseBadge>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Tem {{ formatQuantity(product.currentStock) }} {{ product.unitAbbreviation }} ·
                  mínimo {{ formatQuantity(product.minStock) }} {{ product.unitAbbreviation }}
                </p>
              </li>
            </ul>

            <div
              v-if="operational.lossesToday.count > 0 || semMinimo > 0"
              class="mt-1 px-4 py-2 border-t border-gray-100 dark:border-gray-700 space-y-1"
            >
              <p v-if="operational.lossesToday.count > 0" class="text-xs text-gray-500 dark:text-gray-400">
                Perdas de hoje: {{ operational.lossesToday.count }}
                {{ operational.lossesToday.count === 1 ? 'registro' : 'registros' }},
                {{ formatCurrency(operational.lossesToday.value) }}
              </p>
              <RouterLink
                v-if="semMinimo > 0"
                :to="{ name: 'produtos' }"
                class="block text-xs text-gray-500 hover:text-primary-700 dark:text-gray-400 dark:hover:text-primary-400"
                @click="close"
              >
                {{ semMinimo }}
                {{ semMinimo === 1 ? 'produto ainda não tem' : 'produtos ainda não têm' }} estoque mínimo definido
              </RouterLink>
            </div>
          </div>
        </template>
      </div>

      <div class="shrink-0 px-4 py-2 border-t border-gray-100 dark:border-gray-700">
        <RouterLink
          v-if="isPlataforma"
          :to="{ name: 'cobrancas', query: { status: 'overdue' } }"
          class="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline"
          @click="close"
        >
          Abrir cobranças atrasadas
        </RouterLink>
        <RouterLink
          v-else
          :to="{ name: 'estoque', query: { lowStockOnly: '1' } }"
          class="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline"
          @click="close"
        >
          Ver todos no estoque
        </RouterLink>
      </div>
    </div>
  </div>
</template>
