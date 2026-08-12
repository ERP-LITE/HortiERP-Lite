import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/modules/auth/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/modules/dashboard/DashboardView.vue'),
    },
    {
      path: '/produtos',
      name: 'produtos',
      component: () => import('@/modules/produtos/ProductsView.vue'),
    },
    {
      path: '/categorias',
      name: 'categorias',
      component: () => import('@/modules/categorias/CategoriesView.vue'),
    },
    {
      path: '/unidades',
      name: 'unidades',
      component: () => import('@/modules/unidades/UnitsView.vue'),
    },
    {
      path: '/entradas',
      name: 'entradas',
      component: () => import('@/modules/entradas/StockEntriesView.vue'),
    },
    {
      path: '/entradas/nova',
      name: 'entradas-nova',
      component: () => import('@/modules/entradas/StockEntryFormView.vue'),
    },
    {
      path: '/entradas/:id',
      name: 'entradas-detalhes',
      component: () => import('@/modules/entradas/StockEntryDetailsView.vue'),
    },
    {
      path: '/estoque',
      name: 'estoque',
      component: () => import('@/modules/estoque/StockView.vue'),
    },
    {
      path: '/estoque/movimentacoes',
      name: 'movimentacoes',
      component: () => import('@/modules/estoque/StockMovementsView.vue'),
    },
    {
      path: '/perdas',
      name: 'perdas',
      component: () => import('@/modules/perdas/LossesView.vue'),
    },
    {
      path: '/relatorios',
      name: 'relatorios',
      component: () => import('@/modules/relatorios/ReportsView.vue'),
    },
    {
      path: '/usuarios',
      name: 'usuarios',
      component: () => import('@/modules/usuarios/UsersView.vue'),
      meta: { roles: ['admin'] },
    },
    {
      path: '/perfil',
      name: 'perfil',
      component: () => import('@/modules/perfil/ProfileView.vue'),
    },
    {
      path: '/logs/atividades',
      name: 'logs-atividades',
      component: () => import('@/modules/logs/ActivityLogsView.vue'),
      meta: { roles: ['admin'] },
    },
    {
      path: '/empresas',
      name: 'empresas',
      component: () => import('@/modules/empresas/CompaniesView.vue'),
      meta: { roles: ['super_admin'] },
    },
    {
      path: '/cobrancas',
      name: 'cobrancas',
      component: () => import('@/modules/cobrancas/BillingsView.vue'),
      meta: { roles: ['super_admin'] },
    },
    {
      path: '/selecionar-empresa',
      name: 'selecionar-empresa',
      component: () => import('@/modules/empresas/SelectCompanyView.vue'),
      meta: { roles: ['super_admin'] },
    },
    {
      path: '/logs/tecnicos',
      name: 'logs-tecnicos',
      component: () => import('@/modules/logs/SystemLogsView.vue'),
      props: { mode: 'technical' },
      meta: { roles: ['super_admin'] },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.restoreSession()
  }

  const isAuthenticated = !!auth.user
  const isSuperAdmin = auth.user?.role === 'super_admin'

  if (!to.meta.public && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && isAuthenticated) {
    return { name: isSuperAdmin ? 'selecionar-empresa' : 'dashboard' }
  }

  if (
    isSuperAdmin &&
    !to.meta.public &&
    to.name !== 'empresas' &&
    to.name !== 'cobrancas' &&
    to.name !== 'selecionar-empresa' &&
    to.name !== 'logs-tecnicos' &&
    to.name !== 'perfil'
  ) {
    return { name: 'selecionar-empresa' }
  }

  const allowedRoles = to.meta.roles as string[] | undefined

  if (allowedRoles && (!auth.user || !allowedRoles.includes(auth.user.role))) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
