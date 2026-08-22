<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { api } from '@/api'
import type { SalesSummary } from '@/types/api'

use([CanvasRenderer, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent])
const range = ref<[string, string]>([dayjs().subtract(6, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')])
const loading = ref(false)
const summary = ref<SalesSummary>({ orderCount: 0, paidOrderCount: 0, ticketCount: 0, grossSales: 0, refundAmount: 0, netRevenue: 0 })
const trend = ref<Record<string, unknown>[]>([])
const routes = ref<Record<string, unknown>[]>([])
const params = computed(() => ({ startDate: range.value?.[0], endDate: range.value?.[1] }))

const salesOption = computed(() => ({
  tooltip: { trigger: 'axis' }, grid: { left: 72, right: 20, top: 24, bottom: 42 },
  xAxis: { type: 'category', data: trend.value.map(item => item.period) },
  yAxis: { type: 'value', axisLabel: { formatter: '¥{value}' } },
  series: [{ name: '净收入', type: 'line', smooth: true, data: trend.value.map(item => Number(item.netRevenue || 0)), areaStyle: { color: 'rgba(8,120,249,.12)' }, lineStyle: { color: '#0878f9', width: 3 }, itemStyle: { color: '#0878f9' } }]
}))
const routeOption = computed(() => ({
  tooltip: { trigger: 'item' }, legend: { type: 'scroll', bottom: 0, left: 8, right: 8 },
  series: [{ type: 'pie', radius: ['40%', '64%'], center: ['50%', '43%'], avoidLabelOverlap: true,
    label: { formatter: '{b}\n{c} 张', overflow: 'truncate', width: 110 },
    data: routes.value.map(item => ({ name: `${item.fromStationName}—${item.toStationName}`, value: Number(item.ticketCount || 0) })),
    itemStyle: { borderColor: '#fff', borderWidth: 3 } }]
}))

async function load() {
  loading.value = true
  try {
    const [summaryData, trendData, routeData] = await Promise.all([
      api.admin.salesSummary(params.value), api.admin.salesTrend({ ...params.value, granularity: 'DAY' }), api.admin.popularRoutes({ ...params.value, limit: 8 })
    ])
    summary.value = summaryData
    trend.value = trendData
    routes.value = routeData
  } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <div class="page-heading">
      <div><h1>运营看板</h1><p>销售汇总、趋势和热门线路均来自管理端报表接口</p></div>
      <div style="display:flex;gap:10px"><el-date-picker v-model="range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" :clearable="false"/><el-button type="primary" @click="load">查询</el-button></div>
    </div>
    <div class="metric-grid">
      <article class="metric-card surface"><label>订单总数</label><strong>{{ Number(summary.orderCount || 0).toLocaleString() }}</strong><small>已支付 {{ Number(summary.paidOrderCount || 0).toLocaleString() }} 单</small></article>
      <article class="metric-card surface"><label>出票张数</label><strong>{{ Number(summary.ticketCount || 0).toLocaleString() }}</strong><small>所选日期范围</small></article>
      <article class="metric-card surface"><label>销售总额</label><strong>¥{{ Number(summary.grossSales || 0).toLocaleString() }}</strong><small>改签补款 ¥{{ Number(summary.changePaymentAmount || 0).toLocaleString() }}</small></article>
      <article class="metric-card surface"><label>净收入</label><strong>¥{{ Number(summary.netRevenue || 0).toLocaleString() }}</strong><small>退款 ¥{{ Number(summary.refundAmount || 0).toLocaleString() }}</small></article>
    </div>
    <div class="dashboard-grid">
      <section class="chart-card surface"><div class="section-title"><div><h2 style="font-size:18px">销售趋势</h2><p>{{ range[0] }} 至 {{ range[1] }}</p></div></div><VChart v-if="trend.length" class="chart" :option="salesOption" autoresize/><el-empty v-else description="当前范围没有销售趋势数据"/></section>
      <section class="chart-card surface"><div class="section-title"><div><h2 style="font-size:18px">热门 OD 区间</h2><p>按出票张数统计</p></div></div><VChart v-if="routes.length" class="chart" :option="routeOption" autoresize/><el-empty v-else description="当前范围没有热门线路数据"/></section>
    </div>
  </div>
</template>
