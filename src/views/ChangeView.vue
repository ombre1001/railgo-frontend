<script setup lang="ts">
import { onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import UserCenterShell from '@/components/UserCenterShell.vue'
import { api } from '@/api'

type Row = Record<string, any>
const tickets = ref<Row[]>([])
const loading = ref(false)
const returnDialog = ref(false)
const returnPreview = ref<Row | null>(null)
const changeDialog = ref(false)
const selectedTicket = ref<Row | null>(null)
const changeDate = ref('')
const options = ref<Row[]>([])
const selectedOption = ref<Row | null>(null)
const changeDetail = ref<Row | null>(null)

async function load() { loading.value = true; try { const data = await api.afterSales.tickets({ page: 1, size: 100 }); tickets.value = data.records || data.list || [] } finally { loading.value = false } }
async function previewReturn(ticket: Row) { returnPreview.value = await api.afterSales.returnPreview(Number(ticket.ticketId)); returnDialog.value = true }
async function confirmReturn() {
  if (!returnPreview.value) return
  await ElMessageBox.confirm(`确认退票并退款 ¥${returnPreview.value.refundAmount} 吗？`, '确认退票')
  await api.afterSales.returnTicket(Number(returnPreview.value.ticketId))
  ElMessage.success('退票与退款已由后端完成')
  returnDialog.value = false
  await load()
}
function openChange(ticket: Row) {
  selectedTicket.value = ticket
  changeDate.value = dayjs(ticket.departureDateTime).add(1, 'day').format('YYYY-MM-DD')
  options.value = []; selectedOption.value = null; changeDetail.value = null; changeDialog.value = true
}
async function loadOptions() {
  if (!selectedTicket.value || !changeDate.value) return
  options.value = await api.afterSales.changeOptions(Number(selectedTicket.value.ticketId), changeDate.value)
}
async function previewChange(option: Row) {
  if (!selectedTicket.value) return
  selectedOption.value = option
  changeDetail.value = await api.afterSales.changePreview(Number(selectedTicket.value.ticketId), { newRunId: Number(option.runId), fromStationId: Number(option.fromStationId), toStationId: Number(option.toStationId), seatTypeCode: option.seatTypeCode, clientRequestId: crypto.randomUUID() })
}
async function completeChange() {
  if (!changeDetail.value) return
  const id = Number(changeDetail.value.changeId)
  if (changeDetail.value.differenceType === 'PAY_DIFFERENCE') await api.afterSales.payChange(id)
  else await api.afterSales.confirmChange(id)
  ElMessage.success('改签已完成')
  changeDialog.value = false
  await load()
}
onMounted(load)
</script>

<template><UserCenterShell><div class="section-title"><div><h2>退票与改签</h2><p>车票、退票试算、候选车次和差价均由后端实时计算</p></div></div><div v-loading="loading"><article v-for="ticket in tickets" :key="ticket.ticketId" class="order-card soft-surface"><div class="order-head"><span>{{ ticket.orderNo }}</span><el-tag>{{ ticket.ticketStatus }}</el-tag></div><div class="order-body"><div class="order-route"><strong>{{ ticket.fromStationName }} → {{ ticket.toStationName }}</strong><p>{{ ticket.trainNo }} · {{ ticket.departureDateTime }}</p></div><div>{{ ticket.seatTypeName }}<br><small class="muted">{{ ticket.coachNo }}车 {{ ticket.seatNo }}</small></div><div class="price">¥{{ ticket.price }}</div><div><el-button v-if="ticket.ticketStatus==='ISSUED'" type="primary" link @click="openChange(ticket)">改签</el-button><el-button v-if="ticket.ticketStatus==='ISSUED'" type="danger" link @click="previewReturn(ticket)">退票试算</el-button></div></div></article><el-empty v-if="!tickets.length" description="暂无车票记录"/></div>

<el-dialog v-model="returnDialog" title="退票试算" width="560"><el-descriptions v-if="returnPreview" :column="1" border><el-descriptions-item label="车票">{{ returnPreview.trainNo }} · {{ returnPreview.fromStationName }} → {{ returnPreview.toStationName }}</el-descriptions-item><el-descriptions-item label="票面金额">¥{{ returnPreview.ticketAmount }}</el-descriptions-item><el-descriptions-item label="手续费率">{{ Number(returnPreview.feeRate || 0) * 100 }}%</el-descriptions-item><el-descriptions-item label="手续费">¥{{ returnPreview.feeAmount }}</el-descriptions-item><el-descriptions-item label="退款金额">¥{{ returnPreview.refundAmount }}</el-descriptions-item></el-descriptions><template #footer><el-button @click="returnDialog=false">取消</el-button><el-button type="danger" @click="confirmReturn">确认退票</el-button></template></el-dialog>

<el-dialog v-model="changeDialog" title="车票改签" width="900"><div style="display:flex;gap:10px;margin-bottom:18px"><el-date-picker v-model="changeDate" type="date" value-format="YYYY-MM-DD" :clearable="false"/><el-button type="primary" @click="loadOptions">查询可改签车次</el-button></div><el-table :data="options" highlight-current-row @current-change="selectedOption=$event"><el-table-column prop="trainNo" label="车次"/><el-table-column label="区间"><template #default="{row}">{{ row.fromStationName }} → {{ row.toStationName }}</template></el-table-column><el-table-column prop="departureDateTime" label="出发时间" min-width="170"/><el-table-column prop="seatTypeName" label="席别"/><el-table-column prop="availableCount" label="余票"/><el-table-column prop="price" label="票价"/><el-table-column label="操作"><template #default="{row}"><el-button link type="primary" @click="previewChange(row)">锁座并试算</el-button></template></el-table-column></el-table><el-empty v-if="!options.length" description="请选择日期并查询候选车次"/><el-descriptions v-if="changeDetail" :column="3" border style="margin-top:20px"><el-descriptions-item label="原票价">¥{{ changeDetail.originalAmount }}</el-descriptions-item><el-descriptions-item label="新票价">¥{{ changeDetail.newAmount }}</el-descriptions-item><el-descriptions-item label="差价">{{ changeDetail.differenceType }} ¥{{ changeDetail.differenceAmount }}</el-descriptions-item><el-descriptions-item label="新车次">{{ changeDetail.newTrainNo }}</el-descriptions-item><el-descriptions-item label="新座位">{{ changeDetail.newCoachNo }}车 {{ changeDetail.newSeatNo }}</el-descriptions-item><el-descriptions-item label="锁定截止">{{ changeDetail.expireAt }}</el-descriptions-item></el-descriptions><template #footer><el-button @click="changeDialog=false">关闭</el-button><el-button v-if="changeDetail" type="primary" @click="completeChange">{{ changeDetail.differenceType==='PAY_DIFFERENCE'?'补款并完成改签':'确认改签' }}</el-button></template></el-dialog>
</UserCenterShell></template>
