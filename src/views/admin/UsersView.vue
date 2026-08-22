<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import type { UserProfile } from '@/types/api'

type Row = Record<string, any>
const list = ref<UserProfile[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ page: 1, size: 20, keyword: '', status: '', roleCode: '' })
const roleOptions = ref<Row[]>([])
const roleDialog = ref(false)
const selected = ref<UserProfile | null>(null)
const selectedRoles = ref<string[]>([])
const createDialog = ref(false)
const createForm = reactive({ phone: '', password: '', nickname: '', email: '', roles: [] as string[] })

async function load() {
  loading.value = true
  try { const data = await api.admin.users(query); list.value = data.records || data.list || []; total.value = Number(data.total || 0) }
  finally { loading.value = false }
}
function assign(row: UserProfile) { selected.value = row; selectedRoles.value = [...(row.roles || [])]; roleDialog.value = true }
async function saveRoles() {
  if (!selected.value || !selectedRoles.value.length) return ElMessage.warning('至少选择一个角色')
  await api.admin.updateUserRoles(selected.value.id, selectedRoles.value)
  ElMessage.success('角色分配已保存')
  roleDialog.value = false
  await load()
}
async function toggleStatus(row: UserProfile) {
  const next = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  await ElMessageBox.confirm(`确定将 ${row.nickname || row.phone} 设置为 ${next} 吗？`, '修改用户状态')
  await api.admin.updateUserStatus(row.id, next)
  ElMessage.success('用户状态已更新')
  await load()
}
async function resetPassword(row: UserProfile) {
  const result = await ElMessageBox.prompt(`为 ${row.nickname || row.phone} 设置新密码`, '重置密码', { inputType: 'password', inputPattern: /^.{8,64}$/, inputErrorMessage: '密码长度必须为8～64位' })
  await api.admin.resetUserPassword(row.id, result.value)
  ElMessage.success('密码已重置')
}
async function createAdmin() {
  if (!createForm.phone || !createForm.password || !createForm.nickname || !createForm.roles.length) return ElMessage.warning('请填写手机号、密码、昵称并选择角色')
  await api.admin.createAdmin({ ...createForm })
  ElMessage.success('管理员已创建')
  createDialog.value = false
  Object.assign(createForm, { phone: '', password: '', nickname: '', email: '', roles: [] })
  await load()
}
onMounted(async () => { roleOptions.value = await api.admin.roles(); await load() })
</script>

<template>
  <div>
    <div class="page-heading"><div><h1>用户与权限</h1><p>创建管理员、分配角色、切换状态和重置密码均调用后端接口</p></div><el-button type="primary" @click="createDialog=true">新增管理员</el-button></div>
    <section class="table-card surface">
      <div class="toolbar"><div class="toolbar-left"><el-input v-model="query.keyword" placeholder="手机号 / 昵称 / 邮箱" clearable style="width:240px"/><el-select v-model="query.status" clearable placeholder="状态" style="width:120px"><el-option label="启用" value="ENABLED"/><el-option label="禁用" value="DISABLED"/></el-select><el-select v-model="query.roleCode" clearable placeholder="角色" style="width:170px"><el-option v-for="role in roleOptions" :key="role.roleCode" :label="role.roleName || role.roleCode" :value="role.roleCode"/></el-select><el-button type="primary" @click="query.page=1;load()">查询</el-button></div></div>
      <el-table v-loading="loading" :data="list"><el-table-column prop="id" label="ID" width="70"/><el-table-column prop="phone" label="手机号"/><el-table-column prop="nickname" label="昵称"/><el-table-column prop="email" label="邮箱" min-width="180"/><el-table-column label="角色" min-width="230"><template #default="{row}"><el-tag v-for="role in row.roles" :key="role" style="margin:2px 5px 2px 0">{{ role }}</el-tag></template></el-table-column><el-table-column prop="status" label="状态" width="100"><template #default="{row}"><el-tag :type="row.status==='DISABLED'?'danger':'success'">{{ row.status }}</el-tag></template></el-table-column><el-table-column label="操作" width="230"><template #default="{row}"><el-button link type="primary" @click="assign(row)">分配角色</el-button><el-button link :type="row.status==='ENABLED'?'danger':'success'" @click="toggleStatus(row)">{{ row.status==='ENABLED'?'禁用':'启用' }}</el-button><el-button link @click="resetPassword(row)">重置密码</el-button></template></el-table-column></el-table>
      <el-pagination v-model:current-page="query.page" :total="total" :page-size="query.size" layout="total, prev, pager, next" style="justify-content:flex-end;margin-top:18px" @current-change="load"/>
    </section>

    <el-dialog v-model="roleDialog" title="分配用户角色" width="500"><p>用户：{{ selected?.nickname }}（{{ selected?.phone }}）</p><el-checkbox-group v-model="selectedRoles" style="display:grid;gap:10px"><el-checkbox v-for="role in roleOptions" :key="role.roleCode" :value="role.roleCode" border>{{ role.roleName || role.roleCode }}</el-checkbox></el-checkbox-group><template #footer><el-button @click="roleDialog=false">取消</el-button><el-button type="primary" @click="saveRoles">保存角色</el-button></template></el-dialog>

    <el-dialog v-model="createDialog" title="新增管理员" width="560"><el-form :model="createForm" label-width="90px"><el-form-item label="手机号" required><el-input v-model="createForm.phone"/></el-form-item><el-form-item label="初始密码" required><el-input v-model="createForm.password" type="password" show-password/></el-form-item><el-form-item label="昵称" required><el-input v-model="createForm.nickname"/></el-form-item><el-form-item label="邮箱"><el-input v-model="createForm.email"/></el-form-item><el-form-item label="角色" required><el-select v-model="createForm.roles" multiple style="width:100%"><el-option v-for="role in roleOptions" :key="role.roleCode" :label="role.roleName || role.roleCode" :value="role.roleCode"/></el-select></el-form-item></el-form><template #footer><el-button @click="createDialog=false">取消</el-button><el-button type="primary" @click="createAdmin">创建</el-button></template></el-dialog>
  </div>
</template>
