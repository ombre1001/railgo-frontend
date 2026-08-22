<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { api } from '@/api'

type Row = Record<string, any>
const tab = ref<'payments' | 'refunds' | 'changes'>('payments')
const list = ref<Row[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ page: 1, size: 20, status: '', number: '', orderNo: '', trainNo: '' })
async function load() {
  loading.value = true
  try {
    const common = { page: query.page, size: query.size, status: query.status, orderNo: query.orderNo }
    const data = tab.value === 'payments'
      ? await api.admin.payments({ ...common, paymentNo: query.number })
      : tab.value === 'refunds'
        ? await api.admin.refunds({ ...common, refundNo: query.number })
        : await api.admin.changes({ ...common, changeNo: query.number, trainNo: query.trainNo })
    list.value = data.records || data.list || []
    total.value = Number(data.total || 0)
  } finally { loading.value = false }
}
watch(tab, () => { query.page = 1; query.number = ''; query.status = ''; load() })
onMounted(load)
</script>

<template>
  <div>
    <div class="page-heading"><div><h1>支付、退款与改签</h1><p>三个标签分别调用支付、退款和改签分页接口</p></div></div>
    <section class="table-card surface">
      <el-tabs v-model="tab"><el-tab-pane label="支付流水" name="payments"/><el-tab-pane label="退款流水" name="refunds"/><el-tab-pane label="改签记录" name="changes"/></el-tabs>
      <div class="toolbar"><div class="toolbar-left"><el-input v-model="query.number" :placeholder="tab==='payments'?'支付单号':tab==='refunds'?'退款单号':'改签单号'" clearable style="width:200px"/><el-input v-model="query.orderNo" placeholder="订单号" clearable style="width:190px"/><el-input v-if="tab==='changes'" v-model="query.trainNo" placeholder="车次号" clearable style="width:120px"/><el-input v-model="query.status" placeholder="状态" clearable style="width:150px"/><el-button type="primary" @click="query.page=1;load()">查询</el-button></div></div>

      <el-table v-if="tab==='payments'" v-loading="loading" :data="list"><el-table-column prop="paymentNo" label="支付单号" min-width="190"/><el-table-column prop="orderNo" label="订单号" min-width="190"/><el-table-column prop="userPhone" label="用户"/><el-table-column prop="channel" label="渠道"/><el-table-column prop="amount" label="金额"><template #default="{row}">¥{{ row.amount }}</template></el-table-column><el-table-column prop="status" label="状态"/><el-table-column prop="paidAt" label="支付时间" min-width="170"/><el-table-column prop="createdAt" label="创建时间" min-width="170"/></el-table>
      <el-table v-else-if="tab==='refunds'" v-loading="loading" :data="list"><el-table-column prop="refundNo" label="退款单号" min-width="190"/><el-table-column prop="returnNo" label="退票单号" min-width="190"/><el-table-column prop="orderNo" label="订单号" min-width="190"/><el-table-column prop="userPhone" label="用户"/><el-table-column prop="ticketAmount" label="票款"/><el-table-column prop="feeAmount" label="手续费"/><el-table-column prop="amount" label="退款金额"/><el-table-column prop="status" label="状态"/><el-table-column prop="refundedAt" label="退款时间" min-width="170"/></el-table>
      <el-table v-else v-loading="loading" :data="list"><el-table-column prop="changeNo" label="改签单号" min-width="190"/><el-table-column prop="orderNo" label="订单号" min-width="190"/><el-table-column prop="userPhone" label="用户"/><el-table-column prop="oldTrainNo" label="原车次"/><el-table-column prop="newTrainNo" label="新车次"/><el-table-column prop="differenceAmount" label="差价"/><el-table-column prop="differenceType" label="差价类型" min-width="150"/><el-table-column prop="status" label="状态"/><el-table-column prop="createdAt" label="创建时间" min-width="170"/></el-table>
      <el-pagination v-model:current-page="query.page" :total="total" :page-size="query.size" layout="total, prev, pager, next" style="justify-content:flex-end;margin-top:18px" @current-change="load"/>
    </section>
  </div>
</template>
