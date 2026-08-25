<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import UserCenterShell from '@/components/UserCenterShell.vue'
import { api } from '@/api'

const loading = ref(false)
const form = reactive({ nickname: '', phone: '', email: '', verificationCode: '' })
const passwordVisible = ref(false)
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
onMounted(async () => { const profile = await api.user.profile(); Object.assign(form, profile, { phone: profile.phone || '', email: profile.email || '' }) })
async function save() {
  loading.value = true
  try { const updated = await api.user.updateProfile({ nickname: form.nickname }); Object.assign(form, updated, { phone: updated.phone || '', email: updated.email || '', verificationCode: '' }); ElMessage.success('个人资料已更新') }
  finally { loading.value = false }
}
async function changePassword() {
  if (!passwordForm.oldPassword || passwordForm.newPassword.length < 8) return ElMessage.warning('请填写原密码，新密码至少8位')
  if (passwordForm.newPassword !== passwordForm.confirmPassword) return ElMessage.warning('两次新密码不一致')
  await api.user.changePassword({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword })
  ElMessage.success('密码已修改，请重新登录')
  passwordVisible.value = false
}
</script>
<template><UserCenterShell><div class="section-title"><div><h2>个人资料</h2><p>邮箱是当前登录账号，短信开通后可绑定手机号</p></div></div><el-form :model="form" label-width="100px" style="max-width:620px" size="large"><el-form-item label="昵称"><el-input v-model="form.nickname"/></el-form-item><el-form-item label="手机号"><el-input v-model="form.phone" disabled placeholder="短信服务开通后可绑定"/></el-form-item><el-form-item label="登录邮箱"><el-input v-model="form.email" disabled/></el-form-item><el-form-item><el-button type="primary" :loading="loading" @click="save">保存修改</el-button></el-form-item></el-form><el-divider/><h3>账号安全</h3><el-button style="margin-top:10px" @click="passwordVisible=true">修改登录密码</el-button><el-dialog v-model="passwordVisible" title="修改登录密码" width="500"><el-form :model="passwordForm" label-width="100px"><el-form-item label="原密码"><el-input v-model="passwordForm.oldPassword" type="password" show-password/></el-form-item><el-form-item label="新密码"><el-input v-model="passwordForm.newPassword" type="password" show-password/></el-form-item><el-form-item label="确认新密码"><el-input v-model="passwordForm.confirmPassword" type="password" show-password/></el-form-item></el-form><template #footer><el-button @click="passwordVisible=false">取消</el-button><el-button type="primary" @click="changePassword">确认修改</el-button></template></el-dialog></UserCenterShell></template>
