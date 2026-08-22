<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import type { Station } from '@/types/api'

const loading = ref(false)
const saving = ref(false)
const list = ref<Station[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '', status: '' })
const dialog = ref(false)
const editingId = ref<number | null>(null)
const emptyForm = () => ({ stationCode: '', name: '', normalizedName: '', pinyin: '', pinyinInitial: '', province: '', city: '', district: '', address: '', railwayBureau: '', passengerService: true, luggageService: false, parcelService: false, longitude: undefined as number | undefined, latitude: undefined as number | undefined, hotScore: 0 })
const form = reactive(emptyForm())

async function load() {
  loading.value = true
  try {
    const data = await api.admin.stations(query)
    list.value = data.records || data.list || []
    total.value = Number(data.total || 0)
  } finally { loading.value = false }
}

async function open(row?: Station) {
  editingId.value = row?.id || null
  Object.assign(form, emptyForm())
  if (row) Object.assign(form, await api.admin.stationDetail(row.id))
  dialog.value = true
}

async function save() {
  if (!form.stationCode || !form.name) return ElMessage.warning('请填写车站代码和车站名称')
  if (!form.normalizedName) form.normalizedName = form.name
  saving.value = true
  try {
    if (editingId.value) await api.admin.updateStation(editingId.value, { ...form })
    else await api.admin.createStation({ ...form })
    ElMessage.success(editingId.value ? '车站信息已更新' : '车站已创建')
    dialog.value = false
    await load()
  } finally { saving.value = false }
}

async function toggleStatus(row: Station) {
  const next = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  await ElMessageBox.confirm(`确定将“${row.name}”设置为${next === 'ACTIVE' ? '启用' : '停用'}吗？`, '修改车站状态')
  await api.admin.updateStationStatus(row.id, next)
  ElMessage.success('车站状态已更新')
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-heading"><div><h1>车站管理</h1><p>状态、客运属性和基础信息均读取自车站表</p></div><el-button type="primary" @click="open()">新增车站</el-button></div>
    <section class="table-card surface">
      <div class="toolbar"><div class="toolbar-left"><el-input v-model="query.keyword" placeholder="站名 / 拼音 / 三字码" clearable style="width:250px" @keyup.enter="load"/><el-select v-model="query.status" placeholder="真实状态" clearable style="width:130px"><el-option label="启用" value="ACTIVE"/><el-option label="停用" value="INACTIVE"/></el-select><el-button type="primary" @click="query.page=1;load()">查询</el-button></div><el-tag type="info">共 {{ total }} 个车站</el-tag></div>
      <el-table v-loading="loading" :data="list">
        <el-table-column prop="id" label="ID" width="75"/><el-table-column prop="stationCode" label="车站代码" width="150"/><el-table-column prop="name" label="车站名称" min-width="130"/><el-table-column prop="city" label="城市"/><el-table-column prop="province" label="省份"/><el-table-column prop="railwayBureau" label="铁路局" min-width="150"/>
        <el-table-column label="客运" width="80"><template #default="{row}">{{ row.passengerService ? '是' : '否' }}</template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="{row}"><el-tag :type="row.status==='ACTIVE'?'success':'info'">{{ row.status==='ACTIVE'?'启用':'停用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="160" fixed="right"><template #default="{row}"><el-button link type="primary" @click="open(row)">编辑</el-button><el-button link :type="row.status==='ACTIVE'?'danger':'success'" @click="toggleStatus(row)">{{ row.status==='ACTIVE'?'停用':'启用' }}</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" :total="total" :page-size="query.size" layout="total, prev, pager, next" style="justify-content:flex-end;margin-top:18px" @current-change="load"/>
    </section>

    <el-dialog v-model="dialog" :title="editingId?'编辑车站':'新增车站'" width="760">
      <el-form :model="form" label-width="100px">
        <div class="form-grid"><el-form-item label="车站名称" required><el-input v-model="form.name" @blur="!form.normalizedName && (form.normalizedName=form.name)"/></el-form-item><el-form-item label="车站代码" required><el-input v-model="form.stationCode"/></el-form-item><el-form-item label="标准化名称" required><el-input v-model="form.normalizedName"/></el-form-item><el-form-item label="拼音"><el-input v-model="form.pinyin"/></el-form-item><el-form-item label="拼音首字母"><el-input v-model="form.pinyinInitial"/></el-form-item><el-form-item label="省份"><el-input v-model="form.province"/></el-form-item><el-form-item label="城市"><el-input v-model="form.city"/></el-form-item><el-form-item label="区县"><el-input v-model="form.district"/></el-form-item><el-form-item label="铁路局"><el-input v-model="form.railwayBureau"/></el-form-item><el-form-item label="热门分值"><el-input-number v-model="form.hotScore" :min="0"/></el-form-item></div>
        <el-form-item label="服务属性"><el-checkbox v-model="form.passengerService">客运</el-checkbox><el-checkbox v-model="form.luggageService">行李</el-checkbox><el-checkbox v-model="form.parcelService">包裹</el-checkbox></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" type="textarea"/></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
