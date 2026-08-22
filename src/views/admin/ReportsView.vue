<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { ElMessage } from 'element-plus'
import { api } from '@/api'

use([CanvasRenderer, BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent])
type Row = Record<string, any>
const range = ref<[string, string]>([dayjs().subtract(30, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')])
const tab = ref<'sales' | 'routes' | 'load' | 'users'>('sales')
const granularity = ref('DAY')
const trainNo = ref('')
const seatTypeCode = ref('')
const loading = ref(false)
const rows = ref<Row[]>([])
const userStats = ref<Row>({})
const reportTypes: Record<string, string> = { sales: 'SALES_TREND', routes: 'POPULAR_ROUTES', load: 'LOAD_FACTOR' }
const params = computed(() => ({ startDate: range.value?.[0], endDate: range.value?.[1], granularity: granularity.value, trainNo: trainNo.value, seatTypeCode: seatTypeCode.value }))

const option = computed(() => {
  if (tab.value === 'sales') return { tooltip: { trigger: 'axis' }, legend: { top: 0 }, grid: { left: 70, right: 24, top: 44, bottom: 45 }, xAxis: { type: 'category', data: rows.value.map(item => item.period) }, yAxis: { type: 'value' }, series: [{ name: '销售额', type: 'bar', data: rows.value.map(item => Number(item.grossSales || 0)), itemStyle: { color: '#0878f9' } }, { name: '净收入', type: 'line', data: rows.value.map(item => Number(item.netRevenue || 0)), itemStyle: { color: '#ff8a00' } }] }
  if (tab.value === 'routes') return { tooltip: { trigger: 'axis' }, grid: { left: 70, right: 24, top: 24, bottom: 80 }, xAxis: { type: 'category', axisLabel: { rotate: 25 }, data: rows.value.map(item => `${item.fromStationName}—${item.toStationName}`) }, yAxis: { type: 'value' }, series: [{ name: '出票张数', type: 'bar', data: rows.value.map(item => Number(item.ticketCount || 0)), itemStyle: { color: '#0878f9' } }] }
  return { tooltip: { trigger: 'axis' }, grid: { left: 70, right: 24, top: 24, bottom: 70 }, xAxis: { type: 'category', axisLabel: { rotate: 25 }, data: rows.value.map(item => `${item.trainNo}/${item.seatTypeName}`) }, yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } }, series: [{ name: '上座率', type: 'bar', data: rows.value.map(item => Number(item.loadFactor || 0)), itemStyle: { color: '#22b573' } }] }
})

async function load() {
  loading.value = true
  try {
    if (tab.value === 'sales') rows.value = await api.admin.salesTrend(params.value)
    else if (tab.value === 'routes') rows.value = await api.admin.popularRoutes({ ...params.value, limit: 100 })
    else if (tab.value === 'load') rows.value = await api.admin.loadFactor(params.value)
    else userStats.value = await api.admin.userStatistics(params.value)
  } finally { loading.value = false }
}
async function exportCsv() {
  const fileName = await api.admin.exportReport({ ...params.value, reportType: reportTypes[tab.value] })
  ElMessage.success(`CSV 已下载到浏览器下载目录：${fileName}`)
}
watch(tab, () => { rows.value = []; load() })
onMounted(load)
</script>

<template>
  <div>
    <div class="page-heading"><div><h1>运营报表</h1><p>每个标签调用独立报表接口，CSV 由后端生成</p></div><div style="display:flex;gap:10px"><el-date-picker v-model="range" type="daterange" value-format="YYYY-MM-DD" :clearable="false"/><el-button type="primary" @click="load">查询</el-button><el-button v-if="tab!=='users'" @click="exportCsv">导出当前报表 CSV</el-button></div></div>
    <section class="chart-card surface" v-loading="loading">
      <el-tabs v-model="tab"><el-tab-pane label="销售趋势" name="sales"/><el-tab-pane label="热门线路" name="routes"/><el-tab-pane label="区间上座率" name="load"/><el-tab-pane label="用户统计" name="users"/></el-tabs>
      <div class="toolbar" v-if="tab!=='users'"><div class="toolbar-left"><el-select v-if="tab==='sales'" v-model="granularity" style="width:120px" @change="load"><el-option label="按日" value="DAY"/><el-option label="按周" value="WEEK"/><el-option label="按月" value="MONTH"/></el-select><el-input v-if="tab==='routes'||tab==='load'" v-model="trainNo" placeholder="车次号（可选）" clearable style="width:160px"/><el-input v-if="tab==='load'" v-model="seatTypeCode" placeholder="席别代码（可选）" clearable style="width:180px"/></div></div>
      <template v-if="tab!=='users'"><VChart v-if="rows.length" class="chart" :option="option" autoresize/><el-empty v-else description="当前条件没有报表数据"/></template>
      <div v-else class="metric-grid" style="margin-top:22px"><article class="metric-card"><label>用户总数</label><strong>{{ userStats.totalUsers || 0 }}</strong></article><article class="metric-card"><label>启用用户</label><strong>{{ userStats.enabledUsers || 0 }}</strong></article><article class="metric-card"><label>新增用户</label><strong>{{ userStats.newUsers || 0 }}</strong></article><article class="metric-card"><label>活跃购票用户</label><strong>{{ userStats.activePurchasingUsers || 0 }}</strong></article></div>
    </section>

    <section v-if="rows.length" class="table-card surface" style="margin-top:16px">
      <el-table v-if="tab==='sales'" :data="rows"><el-table-column prop="period" label="周期"/><el-table-column prop="paidOrderCount" label="已支付订单"/><el-table-column prop="ticketCount" label="出票张数"/><el-table-column prop="grossSales" label="销售额"/><el-table-column prop="refundAmount" label="退款额"/><el-table-column prop="netRevenue" label="净收入"/></el-table>
      <el-table v-else-if="tab==='routes'" :data="rows"><el-table-column prop="fromStationName" label="出发站"/><el-table-column prop="toStationName" label="到达站"/><el-table-column prop="ticketCount" label="出票张数"/><el-table-column prop="passengerCount" label="乘客数"/><el-table-column prop="salesAmount" label="销售额"/></el-table>
      <el-table v-else :data="rows"><el-table-column prop="runDate" label="日期"/><el-table-column prop="trainNo" label="车次"/><el-table-column prop="seatTypeName" label="席别"/><el-table-column prop="totalSegmentCount" label="总区间"/><el-table-column prop="soldSegmentCount" label="已售区间"/><el-table-column prop="lockedSegmentCount" label="锁定区间"/><el-table-column prop="loadFactor" label="上座率"/></el-table>
    </section>
  </div>
</template>
