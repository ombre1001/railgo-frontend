<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '@/api'
import type { OrderSummary } from '@/types/api'

type Row = Record<string, any>
const list = ref<OrderSummary[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ page: 1, size: 20, orderNo: '', userId: undefined as number | undefined, status: '', trainNo: '', keyword: '' })
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<Row | null>(null)

async function load() {
  loading.value = true
  try { const data = await api.admin.orders(query); list.value = data.records || data.list || []; total.value = Number(data.total || 0) }
  finally { loading.value = false }
}
async function showDetail(row: OrderSummary) {
  detailVisible.value = true; detailLoading.value = true
  try { detail.value = await api.admin.orderDetail(row.orderId) } finally { detailLoading.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <div class="page-heading"><div><h1>订单管理</h1><p>查询订单并查看车票、库存占用、支付、退款和改签全链路</p></div></div>
    <section class="table-card surface">
      <div class="toolbar"><div class="toolbar-left"><el-input v-model="query.orderNo" placeholder="订单号" clearable style="width:190px"/><el-input v-model="query.keyword" placeholder="手机号 / 昵称 / 乘客" clearable style="width:210px"/><el-input v-model="query.trainNo" placeholder="车次号" clearable style="width:120px"/><el-select v-model="query.status" clearable placeholder="订单状态" style="width:150px"><el-option v-for="status in ['PENDING_PAYMENT','PAID','CANCELLED','EXPIRED','REFUNDED']" :key="status" :value="status"/></el-select><el-button type="primary" @click="query.page=1;load()">查询</el-button></div></div>
      <el-table v-loading="loading" :data="list"><el-table-column prop="orderNo" label="订单号" min-width="200"/><el-table-column prop="trainNos" label="车次" width="110"/><el-table-column label="区间" min-width="170"><template #default="{row}">{{ row.fromStationName }} → {{ row.toStationName }}</template></el-table-column><el-table-column prop="userPhone" label="用户" width="135"/><el-table-column prop="passengerCount" label="乘客" width="70"/><el-table-column prop="totalAmount" label="金额" width="100"><template #default="{row}">¥{{ row.totalAmount }}</template></el-table-column><el-table-column prop="status" label="状态" width="150"><template #default="{row}"><el-tag>{{ row.status }}</el-tag></template></el-table-column><el-table-column prop="createdAt" label="下单时间" min-width="175"/><el-table-column label="操作" width="110"><template #default="{row}"><el-button link type="primary" @click="showDetail(row)">查看全链路</el-button></template></el-table-column></el-table>
      <el-pagination v-model:current-page="query.page" :total="total" :page-size="query.size" layout="total, prev, pager, next" style="justify-content:flex-end;margin-top:18px" @current-change="load"/>
    </section>

    <el-drawer v-model="detailVisible" title="订单全链路" size="72%" destroy-on-close>
      <div v-loading="detailLoading" v-if="detail">
        <el-descriptions :column="3" border><el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item><el-descriptions-item label="用户">{{ detail.userNickname }} / {{ detail.userPhone }}</el-descriptions-item><el-descriptions-item label="状态">{{ detail.status }}</el-descriptions-item><el-descriptions-item label="金额">¥{{ detail.totalAmount }}</el-descriptions-item><el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item><el-descriptions-item label="失效时间">{{ detail.expireAt || '-' }}</el-descriptions-item></el-descriptions>
        <el-tabs style="margin-top:20px">
          <el-tab-pane label="订单车票"><el-table :data="detail.items || []"><el-table-column prop="orderItemId" label="明细ID"/><el-table-column prop="passengerName" label="乘客"/><el-table-column prop="trainNo" label="车次"/><el-table-column label="区间" min-width="170"><template #default="{row}">{{ row.fromStationName }} → {{ row.toStationName }}</template></el-table-column><el-table-column prop="seatTypeName" label="席别"/><el-table-column label="座位"><template #default="{row}">{{ row.coachNo }}车 {{ row.seatNo }}</template></el-table-column><el-table-column prop="price" label="票价"/><el-table-column prop="status" label="状态"/></el-table></el-tab-pane>
          <el-tab-pane label="库存占用"><el-table :data="detail.inventoryOccupations || []"><el-table-column prop="orderItemId" label="明细ID"/><el-table-column prop="trainNo" label="车次"/><el-table-column label="座位"><template #default="{row}">{{ row.coachNo }}车 {{ row.seatNo }}</template></el-table-column><el-table-column label="站序区间"><template #default="{row}">{{ row.fromSeq }} → {{ row.toSeq }}</template></el-table-column><el-table-column prop="occupiedSegmentCount" label="占用段数"/><el-table-column prop="inventoryStatuses" label="库存状态"/></el-table></el-tab-pane>
          <el-tab-pane label="支付流水"><el-table :data="detail.payments || []"><el-table-column prop="paymentNo" label="支付单号"/><el-table-column prop="channel" label="渠道"/><el-table-column prop="amount" label="金额"/><el-table-column prop="status" label="状态"/><el-table-column prop="paidAt" label="支付时间"/></el-table></el-tab-pane>
          <el-tab-pane label="退票退款"><el-table :data="detail.returns || []"><el-table-column prop="returnNo" label="退票单号"/><el-table-column prop="ticketAmount" label="票款"/><el-table-column prop="feeAmount" label="手续费"/><el-table-column prop="refundAmount" label="应退"/><el-table-column prop="status" label="状态"/></el-table><el-table :data="detail.refunds || []" style="margin-top:16px"><el-table-column prop="refundNo" label="退款单号"/><el-table-column prop="amount" label="退款金额"/><el-table-column prop="status" label="状态"/><el-table-column prop="refundedAt" label="退款时间"/></el-table></el-tab-pane>
          <el-tab-pane label="改签"><el-table :data="detail.changes || []"><el-table-column prop="changeNo" label="改签单号"/><el-table-column prop="originalAmount" label="原价"/><el-table-column prop="newAmount" label="新价"/><el-table-column prop="differenceAmount" label="差价"/><el-table-column prop="status" label="状态"/></el-table></el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>
  </div>
</template>
