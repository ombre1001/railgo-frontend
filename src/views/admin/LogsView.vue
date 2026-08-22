<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '@/api'

type Row = Record<string, any>
const list = ref<Row[]>([])
const total = ref(0)
const loading = ref(false)
const range = ref<[string, string] | null>(null)
const query = reactive({ page: 1, size: 20, operatorId: undefined as number | undefined, module: '', action: '', result: '', requestId: '' })
const detailVisible = ref(false)
const detail = ref<Row | null>(null)
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
      <el-table v-loading="loading" :data="list"><el-table-column prop="id" label="ID" width="80"/><el-table-column prop="operatedAt" label="时间" min-width="175"/><el-table-column prop="operatorPhone" label="操作人"/><el-table-column prop="module" label="模块"/><el-table-column prop="action" label="动作" min-width="170"/><el-table-column prop="requestMethod" label="方法" width="80"/><el-table-column prop="requestUri" label="请求路径" min-width="220"/><el-table-column prop="result" label="结果" width="90"><template #default="{row}"><el-tag :type="row.result==='SUCCESS'?'success':'danger'">{{ row.result }}</el-tag></template></el-table-column><el-table-column prop="durationMs" label="耗时(ms)" width="95"/><el-table-column label="操作" width="80"><template #default="{row}"><el-button link type="primary" @click="showDetail(row)">详情</el-button></template></el-table-column></el-table>
      <el-pagination v-model:current-page="query.page" :total="total" :page-size="query.size" layout="total, prev, pager, next" style="justify-content:flex-end;margin-top:18px" @current-change="load"/>
    </section>
    <el-dialog v-model="detailVisible" title="审计日志详情" width="760"><el-descriptions v-if="detail" :column="2" border><el-descriptions-item v-for="(value,key) in detail" :key="String(key)" :label="String(key)" :span="['requestParams','errorMessage'].includes(String(key))?2:1"><pre style="white-space:pre-wrap;margin:0">{{ value ?? '-' }}</pre></el-descriptions-item></el-descriptions></el-dialog>
  </div>
</template>
