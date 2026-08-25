<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { api } from '@/api'

type Row = Record<string, any>
type DetailField = { key: string; label: string; wide?: boolean; code?: boolean }
const list = ref<Row[]>([])
const total = ref(0)
const loading = ref(false)
const range = ref<[string, string] | null>(null)
const query = reactive({ page: 1, size: 20, operatorId: undefined as number | undefined, module: '', action: '', result: '', requestId: '' })
const detailVisible = ref(false)
const detail = ref<Row | null>(null)

const detailFields: DetailField[] = [
  { key: 'id', label: '日志 ID' },
  { key: 'operatorId', label: '操作人 ID' },
  { key: 'operatorPhone', label: '操作人手机号' },
  { key: 'clientIp', label: '客户端 IP' },
  { key: 'module', label: '业务模块' },
  { key: 'action', label: '操作动作', wide: true, code: true },
  { key: 'operatedAt', label: '操作时间' },
  { key: 'durationMs', label: '请求耗时' },
  { key: 'requestMethod', label: '请求方法' },
  { key: 'responseStatus', label: '响应状态' },
  { key: 'requestUri', label: '请求地址', wide: true, code: true },
  { key: 'requestId', label: '请求 ID', wide: true, code: true },
  { key: 'requestParams', label: '请求参数', wide: true, code: true },
  { key: 'errorMessage', label: '错误信息', wide: true }
]
const visibleDetailFields = computed(() => detailFields.filter(field => detail.value && field.key in detail.value))

function formatDateTime(value: unknown) {
  if (!value) return '—'
  const parsed = dayjs(String(value))
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : String(value)
}
function formatDuration(value: unknown) {
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds)) return '—'
  const base = `${milliseconds.toLocaleString()} ms`
  return milliseconds >= 1000 ? `${base}（${(milliseconds / 1000).toFixed(2)} 秒）` : base
}
function formatJson(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  try { return JSON.stringify(JSON.parse(String(value)), null, 2) } catch { return String(value) }
}
function formatDetailValue(field: DetailField) {
  const value = detail.value?.[field.key]
  if (field.key === 'operatedAt') return formatDateTime(value)
  if (field.key === 'durationMs') return formatDuration(value)
  if (field.key === 'requestParams') return formatJson(value)
  return value === null || value === undefined || value === '' ? '—' : String(value)
}
async function load() {
  loading.value = true
  try {
    const data = await api.admin.logs({ ...query, startDate: range.value?.[0], endDate: range.value?.[1] })
    list.value = data.records || data.list || []
    total.value = Number(data.total || 0)
  } finally { loading.value = false }
}
async function showDetail(row: Row) { detail.value = await api.admin.logDetail(Number(row.id)); detailVisible.value = true }
onMounted(load)
</script>

<template>
  <div>
    <div class="page-heading"><div><h1>审计日志</h1><p>筛选条件与日志详情均由操作日志接口提供</p></div></div>
    <section class="table-card surface">
      <div class="toolbar"><div class="toolbar-left" style="flex-wrap:wrap"><el-input-number v-model="query.operatorId" :min="1" placeholder="操作人ID" controls-position="right" style="width:140px"/><el-input v-model="query.module" placeholder="模块" clearable style="width:140px"/><el-input v-model="query.action" placeholder="动作" clearable style="width:160px"/><el-select v-model="query.result" clearable placeholder="结果" style="width:120px"><el-option label="成功" value="SUCCESS"/><el-option label="失败" value="FAILED"/></el-select><el-input v-model="query.requestId" placeholder="请求ID" clearable style="width:190px"/><el-date-picker v-model="range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期"/><el-button type="primary" @click="query.page=1;load()">查询</el-button></div></div>
      <el-table v-loading="loading" :data="list"><el-table-column prop="id" label="ID" width="80"/><el-table-column label="时间" min-width="175"><template #default="{row}">{{ formatDateTime(row.operatedAt) }}</template></el-table-column><el-table-column prop="operatorPhone" label="操作人"/><el-table-column prop="module" label="模块"/><el-table-column prop="action" label="动作" min-width="170" show-overflow-tooltip/><el-table-column prop="requestMethod" label="方法" width="80"/><el-table-column prop="requestUri" label="请求路径" min-width="220" show-overflow-tooltip/><el-table-column prop="result" label="结果" width="90"><template #default="{row}"><el-tag :type="row.result==='SUCCESS'?'success':'danger'">{{ row.result === 'SUCCESS' ? '成功' : '失败' }}</el-tag></template></el-table-column><el-table-column label="耗时" width="110"><template #default="{row}">{{ formatDuration(row.durationMs) }}</template></el-table-column><el-table-column label="操作" width="80"><template #default="{row}"><el-button link type="primary" @click="showDetail(row)">详情</el-button></template></el-table-column></el-table>
      <el-pagination v-model:current-page="query.page" :total="total" :page-size="query.size" layout="total, prev, pager, next" style="justify-content:flex-end;margin-top:18px" @current-change="load"/>
    </section>
    <el-dialog v-model="detailVisible" class="audit-detail-dialog" width="min(920px, calc(100vw - 32px))" top="6vh" destroy-on-close>
      <template #header>
        <div class="dialog-heading">
          <div><h2>审计日志详情</h2><p v-if="detail">日志 #{{ detail.id }} 的完整请求记录</p></div>
          <el-tag v-if="detail" :type="detail.result === 'SUCCESS' ? 'success' : 'danger'" size="large" round>{{ detail.result === 'SUCCESS' ? '执行成功' : '执行失败' }}</el-tag>
        </div>
      </template>
      <div v-if="detail" class="audit-detail-grid">
        <div v-for="field in visibleDetailFields" :key="field.key" class="detail-item" :class="{ wide: field.wide }">
          <span class="detail-label">{{ field.label }}</span>
          <pre :class="['detail-value', { code: field.code }]">{{ formatDetailValue(field) }}</pre>
        </div>
      </div>
      <template #footer><el-button type="primary" @click="detailVisible = false">关闭</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-right: 32px; }
.dialog-heading h2 { margin: 0; color: var(--rg-ink); font-size: 20px; }
.dialog-heading p { margin: 6px 0 0; color: var(--rg-muted); font-size: 13px; }
.audit-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 68vh; overflow-y: auto; border: 1px solid var(--rg-line); border-radius: 12px; background: #fff; }
.detail-item { display: grid; grid-template-columns: 118px minmax(0, 1fr); min-width: 0; border-bottom: 1px solid var(--rg-line); }
.detail-item:nth-child(odd):not(.wide) { border-right: 1px solid var(--rg-line); }
.detail-item.wide { grid-column: 1 / -1; }
.detail-label { display: flex; align-items: center; padding: 13px 14px; background: #f6f8fb; color: #5c6675; font-size: 13px; font-weight: 700; }
.detail-value { min-width: 0; margin: 0; padding: 13px 15px; overflow-wrap: anywhere; white-space: pre-wrap; color: #263548; font-family: inherit; font-size: 14px; line-height: 1.55; }
.detail-value.code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; }
@media (max-width: 700px) {
  .audit-detail-grid { grid-template-columns: 1fr; }
  .detail-item, .detail-item.wide { grid-column: 1; grid-template-columns: 104px minmax(0, 1fr); border-right: 0; }
  .dialog-heading { align-items: flex-start; }
}
</style>
