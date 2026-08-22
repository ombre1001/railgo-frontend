<script setup lang="ts">
import { useRouter } from 'vue-router'
import { UserFilled, Tickets, SwitchButton } from '@element-plus/icons-vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
async function logout() { await auth.logout(); router.push('/') }
</script>

<template>
  <div>
    <header class="top-header">
      <div class="page-container top-header-inner">
        <RouterLink to="/"><BrandLogo /></RouterLink>
        <nav class="header-nav">
          <RouterLink to="/">首页</RouterLink>
          <RouterLink to="/trains">车票查询</RouterLink>
          <RouterLink to="/orders">我的订单</RouterLink>
          <el-dropdown v-if="auth.isLoggedIn">
            <span class="header-user"><el-icon><UserFilled /></el-icon> {{ auth.user?.nickname || '我的账户' }}</span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :icon="Tickets" @click="router.push('/orders')">我的订单</el-dropdown-item>
                <el-dropdown-item @click="router.push('/passengers')">常用乘车人</el-dropdown-item>
                <el-dropdown-item @click="router.push('/profile')">个人资料</el-dropdown-item>
                <el-dropdown-item v-if="auth.isAdmin" @click="router.push('/admin')">进入管理端</el-dropdown-item>
                <el-dropdown-item divided :icon="SwitchButton" @click="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <template v-else>
            <RouterLink class="header-user" to="/login">登录</RouterLink>
            <RouterLink to="/register">注册</RouterLink>
          </template>
        </nav>
      </div>
    </header>
    <main><RouterView /></main>
    <footer style="background:#10243f;color:#b8c8da;padding:38px 0">
      <div class="page-container" style="display:flex;justify-content:space-between;gap:30px;flex-wrap:wrap">
        <div><BrandLogo light /><p style="max-width:480px;line-height:1.8">RailGo 数据库课程设计。车站、车次、余票、订单和管理数据均由后端接口实时提供。</p></div>
        <div><b style="color:#fff">快速入口</b><p>车票查询 · 我的订单 · 常用乘车人 · 管理端</p><small>© 2026 RailGo Course Project</small></div>
      </div>
    </footer>
  </div>
</template>
