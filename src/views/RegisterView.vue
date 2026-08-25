<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import BrandLogo from '@/components/BrandLogo.vue'
import { api } from '@/api'

const router = useRouter()
const formRef = ref<FormInstance>()
const step = ref(1)
const loading = ref(false)
const sending = ref(false)
const countdown = ref(0)
let timer: number | undefined
const form = reactive({ email: '', verificationCode: '', nickname: '', password: '', confirmPassword: '', agreed: true })

const rules: FormRules = {
  email: [{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }],
  verificationCode: [{ required: true, message: '请输入验证码' }, { pattern: /^\d{6}$/, message: '验证码必须为6位数字' }],
  nickname: [{ required: true, message: '请输入昵称' }],
  password: [{ required: true, min: 8, message: '密码至少8位' }, { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '密码必须同时包含字母和数字' }],
  confirmPassword: [{ validator: (_rule, value, callback) => value === form.password ? callback() : callback(new Error('两次密码不一致')), trigger: 'blur' }],
  agreed: [{ validator: (_rule, value, callback) => value ? callback() : callback(new Error('请先同意服务协议与隐私政策')), trigger: 'change' }]
}

function startCountdown() {
  countdown.value = 60
  window.clearInterval(timer)
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) window.clearInterval(timer)
  }, 1000)
}

async function sendCode() {
  const valid = await formRef.value?.validateField('email').then(() => true).catch(() => false)
  if (!valid || sending.value || countdown.value > 0) return
  sending.value = true
  try {
    await api.auth.sendEmailCode({ email: form.email })
    startCountdown()
    ElMessage.success('验证码已发送，请检查收件箱和垃圾邮件')
  } finally { sending.value = false }
}

async function next() {
  if (step.value === 1) {
    const valid = await formRef.value?.validateField(['email', 'verificationCode']).then(() => true).catch(() => false)
    if (valid) step.value = 2
    return
  }
  if (!await formRef.value?.validate().then(() => true).catch(() => false)) return
  loading.value = true
  try {
    await api.auth.register({ email: form.email, verificationCode: form.verificationCode, nickname: form.nickname, password: form.password })
    step.value = 3
    ElMessage.success('注册成功')
  } finally { loading.value = false }
}

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="auth-page" style="background:#fff">
    <header class="auth-header" style="border-bottom:1px solid var(--rg-line)"><div class="page-container"><BrandLogo /></div></header>
    <main class="page-container" style="padding:55px 0 100px;max-width:880px">
      <el-steps :active="step" finish-status="success" align-center style="margin-bottom:55px"><el-step title="验证邮箱" /><el-step title="设置账号" /><el-step title="注册成功" /></el-steps>
      <div class="surface" style="padding:38px;max-width:560px;margin:auto">
        <el-result v-if="step===3" icon="success" title="注册成功" sub-title="请使用邮箱和密码登录 RailGo"><template #extra><el-button type="primary" @click="router.push('/login')">立即登录</el-button></template></el-result>
        <el-form v-else ref="formRef" :model="form" :rules="rules" label-width="92px" size="large">
          <template v-if="step===1">
            <el-form-item label="邮箱" prop="email"><el-input v-model.trim="form.email" placeholder="用于注册和登录的邮箱" /></el-form-item>
            <el-form-item label="验证码" prop="verificationCode"><el-input v-model="form.verificationCode" maxlength="6" placeholder="6位邮箱验证码"><template #append><el-button :loading="sending" :disabled="countdown>0" @click="sendCode">{{ countdown > 0 ? `${countdown}秒后重发` : '获取验证码' }}</el-button></template></el-input></el-form-item>
            <el-alert type="info" :closable="false" title="暂未开通短信服务，新用户使用邮箱完成注册。" style="margin-bottom:20px" />
          </template>
          <template v-else>
            <el-form-item label="昵称" prop="nickname"><el-input v-model="form.nickname" /></el-form-item>
            <el-form-item label="设置密码" prop="password"><el-input v-model="form.password" type="password" show-password /></el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword"><el-input v-model="form.confirmPassword" type="password" show-password /></el-form-item>
          </template>
          <el-form-item prop="agreed"><el-checkbox v-model="form.agreed">同意服务协议与隐私政策</el-checkbox></el-form-item>
          <el-form-item><el-button class="rg-primary" type="primary" :loading="loading" style="width:100%" @click="next">{{ step===1?'下一步，设置账号':'完成注册' }}</el-button></el-form-item>
        </el-form>
      </div>
    </main>
  </div>
</template>
