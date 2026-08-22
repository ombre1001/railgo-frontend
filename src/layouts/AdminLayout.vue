<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { DataAnalysis, OfficeBuilding, Tickets, Calendar, List, Money, TrendCharts, User, Document } from '@element-plus/icons-vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const menus = [
  { path: '/admin', label: '运营看板', icon: DataAnalysis },
  { path: '/admin/stations', label: '车站管理', icon: OfficeBuilding },
  { path: '/admin/trains', label: '车次与座席', icon: Tickets },
  { path: '/admin/runs', label: '运行计划与库存', icon: Calendar },
  { path: '/admin/orders', label: '订单管理', icon: List },
  { path: '/admin/finance', label: '支付退改签', icon: Money },
  { path: '/admin/reports', label: '运营报表', icon: TrendCharts },
  { path: '/admin/users', label: '用户与权限', icon: User },
  { path: '/admin/logs', label: '审计日志', icon: Document }
]

async function logout() { await auth.logout(); router.push('/admin/login') }
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-logo"><BrandLogo light /></div>
      <nav class="admin-menu">
        <RouterLink v-for="item in menus" :key="item.path" :to="item.path" :class="{ 'router-link-active': route.path === item.path }">
          <el-icon size="19"><component :is="item.icon" /></el-icon><span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>
    <section class="admin-main">
      <header class="admin-header">
        <div><b>RailGo 运营管理中心</b><span class="muted" style="margin-left:12px;font-size:12px">当前页面数据来自后端接口</span></div>
        <el-dropdown>
          <span class="header-user">{{ auth.user?.nickname || '管理员' }} ▾</span>
          <template #dropdown><el-dropdown-menu><el-dropdown-item @click="router.push('/')">返回乘客端</el-dropdown-item><el-dropdown-item divided @click="logout">退出登录</el-dropdown-item></el-dropdown-menu></template>
        </el-dropdown>
      </header>
      <main class="admin-content"><RouterView /></main>
    </section>
  </div>
</template>
