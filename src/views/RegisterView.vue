<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import BrandLogo from '@/components/BrandLogo.vue'
import { api } from '@/api'

const router = useRouter()
const formRef = ref<FormInstance>()
const step = ref(1)
const loading = ref(false)
const form = reactive({ phone: '', verificationCode: '', nickname: '', password: '', confirmPassword: '', agreed: true })
const rules: FormRules = {
  phone: [{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '手机号格式不正确' }],
  verificationCode: [{ required: true, message: '请输入验证码' }, { pattern: /^\d{6}$/, message: '验证码必须为6位数字' }],
  nickname: [{ required: true, message: '请输入昵称' }],
  password: [{ required: true, min: 8, message: '密码至少8位' }],
  confirmPassword: [{ validator: (_r, value, callback) => value === form.password ? callback() : callback(new Error('两次密码不一致')), trigger: 'blur' }]
}

async function next() {
  if (step.value === 1) { if (await formRef.value?.validateField(['phone', 'verificationCode']).catch(() => false)) step.value = 2; return }
  if (!await formRef.value?.validate().catch(() => false)) return
  loading.value = true
  try { await api.auth.register(form); step.value = 3; ElMessage.success('注册成功') } finally { loading.value = false }
}
</script>

<template>
  <div class="auth-page" style="background:#fff">
    <header class="auth-header" style="border-bottom:1px solid var(--rg-line)"><div class="page-container"><BrandLogo /></div></header>
    <main class="page-container" style="padding:55px 0 100px;max-width:880px">
      <el-steps :active="step" finish-status="success" align-center style="margin-bottom:55px"><el-step title="验证手机" /><el-step title="设置账号" /><el-step title="注册成功" /></el-steps>
      <div class="surface" style="padding:38px;max-width:560px;margin:auto">
        <el-result v-if="step===3" icon="success" title="注册成功" sub-title="欢迎加入 RailGo，现在可以登录并开始购票"><template #extra><el-button type="primary" @click="router.push('/login')">立即登录</el-button></template></el-result>
        <el-form v-else ref="formRef" :model="form" :rules="rules" label-width="92px" size="large">
          <template v-if="step===1"><el-form-item label="手机号" prop="phone"><el-input v-model="form.phone" placeholder="有效手机号" /></el-form-item><el-form-item label="验证码" prop="verificationCode"><el-input v-model="form.verificationCode" placeholder="请输入后端配置的开发验证码" /></el-form-item><el-alert type="info" :closable="false" title="当前后端未提供短信发送接口，请使用后端配置的开发验证码。" style="margin-bottom:20px" /></template>
          <template v-else><el-form-item label="昵称" prop="nickname"><el-input v-model="form.nickname" /></el-form-item><el-form-item label="设置密码" prop="password"><el-input v-model="form.password" type="password" show-password /></el-form-item><el-form-item label="确认密码" prop="confirmPassword"><el-input v-model="form.confirmPassword" type="password" show-password /></el-form-item></template>
          <el-form-item><el-checkbox v-model="form.agreed">同意服务协议与隐私政策</el-checkbox></el-form-item>
          <el-form-item><el-button class="rg-primary" type="primary" :loading="loading" style="width:100%" @click="next">{{ step===1?'下一步，设置账号':'完成注册' }}</el-button></el-form-item>
        </el-form>
      </div>
    </main>
  </div>
</template>
