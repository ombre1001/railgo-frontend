import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/', component: () => import('@/layouts/PassengerLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/HomeView.vue') },
      { path: 'system', name: 'system-overview', component: () => import('@/views/SystemOverviewView.vue') },
      { path: 'trains', name: 'trains', component: () => import('@/views/TicketListView.vue') },
      { path: 'booking', name: 'booking', component: () => import('@/views/BookingView.vue'), meta: { requiresAuth: true } },
      { path: 'payment/:orderId', name: 'payment', component: () => import('@/views/PaymentView.vue'), meta: { requiresAuth: true } },
      { path: 'orders', name: 'orders', component: () => import('@/views/OrdersView.vue'), meta: { requiresAuth: true } },
      { path: 'orders/:id', name: 'order-detail', component: () => import('@/views/OrderDetailView.vue'), meta: { requiresAuth: true } },
      { path: 'tickets/change', name: 'change', component: () => import('@/views/ChangeView.vue'), meta: { requiresAuth: true } },
      { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { requiresAuth: true } },
      { path: 'passengers', name: 'passengers', component: () => import('@/views/PassengersView.vue'), meta: { requiresAuth: true } }
    ]
  },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue') },
  { path: '/admin/login', name: 'admin-login', component: () => import('@/views/LoginView.vue'), meta: { adminLogin: true } },
  {
    path: '/admin', component: () => import('@/layouts/AdminLayout.vue'), meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('@/views/admin/DashboardView.vue') },
      { path: 'stations', name: 'admin-stations', component: () => import('@/views/admin/StationsView.vue') },
      { path: 'trains', name: 'admin-trains', component: () => import('@/views/admin/TrainsView.vue') },
      { path: 'runs', name: 'admin-runs', component: () => import('@/views/admin/RunsView.vue') },
      { path: 'orders', name: 'admin-orders', component: () => import('@/views/admin/OrdersView.vue') },
      { path: 'finance', name: 'admin-finance', component: () => import('@/views/admin/FinanceView.vue') },
      { path: 'reports', name: 'admin-reports', component: () => import('@/views/admin/ReportsView.vue') },
      { path: 'users', name: 'admin-users', component: () => import('@/views/admin/UsersView.vue') },
      { path: 'logs', name: 'admin-logs', component: () => import('@/views/admin/LogsView.vue') }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHashHistory(), routes, scrollBehavior: () => ({ top: 0 }) })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.token && !auth.sessionChecked) await auth.ensureSession()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: to.meta.requiresAdmin ? 'admin-login' : 'login', query: { redirect: to.fullPath } }
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'admin-login', query: { redirect: to.fullPath, forbidden: '1' } }
  }
})

export default router
