<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import BrandLogo from '@/components/BrandLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { hasAdminRole } from '@/utils/roles'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)
const isAdminLogin = computed(() => route.meta.adminLogin === true)
const wasDenied = computed(() => isAdminLogin.value && route.query.forbidden === '1')
const form = reactive({ phone: '', password: '', agreed: true })
const rules: FormRules = {
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }, { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 8, message: '密码至少8位', trigger: 'blur' }],
  agreed: [{ validator: (_r, value, callback) => value ? callback() : callback(new Error('请先同意服务协议')), trigger: 'change' }]
}

async function submit() {
  if (!await formRef.value?.validate().catch(() => false)) return
  loading.value = true
  try {
    const user = await auth.login(form.phone, form.password)
    if (isAdminLogin.value && !hasAdminRole(user)) {
      await auth.logout()
      ElMessage.error('该账号在数据库中没有管理员角色，无法进入管理端')
      return
    }
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (isAdminLogin.value) {
      await router.replace(redirect.startsWith('/admin') ? redirect : '/admin')
    } else {
      // 普通登录入口始终进入乘客端，即使该账号同时拥有管理员角色。
      await router.replace(redirect.startsWith('/') && !redirect.startsWith('/admin') ? redirect : '/')
    }
  } catch {
    // 请求层已显示后端返回的明确错误信息；在此终止异常传播，
    // 避免 Vue 报 Unhandled error / Uncaught (in promise)。
  } finally { loading.value = false }
}
</script>

<template>
  <div class="auth-page">
    <header class="auth-header"><div class="page-container"><RouterLink to="/"><BrandLogo /></RouterLink></div></header>
    <section class="auth-hero">
      <div class="auth-grid">
        <div class="auth-intro"><span class="admin-badge">{{ isAdminLogin ? 'ADMIN CONSOLE' : 'RAILGO MEMBER' }}</span><h1>{{ isAdminLogin ? '统一管理每一次运行' : '让每一段旅程更从容' }}</h1><p>{{ isAdminLogin ? '车站、车次、运行计划、库存与订单数据一站管理，关键操作全程留痕。' : '登录后可完成购票、支付、订单查询、退票与改签。' }}</p></div>
        <div class="auth-card surface">
          <span v-if="isAdminLogin" class="admin-badge">管理员登录</span>
          <h2>{{ isAdminLogin ? '进入运营管理中心' : '账号密码登录' }}</h2>
          <el-alert v-if="wasDenied" class="login-alert" type="warning" :closable="false" show-icon title="请使用具有管理员角色的账号登录" />
          <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="submit">
            <el-form-item prop="phone"><el-input v-model="form.phone" placeholder="手机号" /></el-form-item>
            <el-form-item prop="password"><el-input v-model="form.password" type="password" show-password placeholder="登录密码" /></el-form-item>
            <el-form-item prop="agreed"><el-checkbox v-model="form.agreed">我已阅读并同意《服务协议》和《隐私政策》</el-checkbox></el-form-item>
            <el-button class="rg-primary" type="primary" size="large" :loading="loading" style="width:100%" @click="submit">{{ isAdminLogin ? '登录管理端' : '登录' }}</el-button>
          </el-form>
          <div class="auth-actions"><RouterLink to="/register">免费注册</RouterLink><RouterLink :to="isAdminLogin ? '/login' : '/admin/login'">{{ isAdminLogin ? '乘客用户登录' : '管理员登录' }}</RouterLink></div>
        </div>
      </div>
    </section>
  </div>
</template>
