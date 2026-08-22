<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserCenterShell from '@/components/UserCenterShell.vue'
import { api } from '@/api'
import type { OrderDetail } from '@/types/api'

const route = useRoute()
const router = useRouter()
const detail = ref<OrderDetail | null>(null)
onMounted(async () => { detail.value = await api.order.detail(Number(route.params.id)) })
</script>

<template><UserCenterShell><template v-if="detail"><div class="section-title"><div><h2>订单详情</h2><p>{{ detail.orderNo }} · 创建于 {{ detail.createdAt }}</p></div><el-tag size="large">{{ detail.status }}</el-tag></div><el-descriptions :column="3" border style="margin-bottom:20px"><el-descriptions-item label="订单金额">¥{{ detail.totalAmount }}</el-descriptions-item><el-descriptions-item label="订单状态">{{ detail.status }}</el-descriptions-item><el-descriptions-item label="剩余支付秒数">{{ detail.remainingSeconds ?? '-' }}</el-descriptions-item><el-descriptions-item label="失效时间">{{ detail.expireAt || '-' }}</el-descriptions-item><el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item><el-descriptions-item label="更新时间">{{ detail.updatedAt || '-' }}</el-descriptions-item></el-descriptions><el-table :data="detail.items || []"><el-table-column prop="passengerName" label="乘车人"/><el-table-column prop="trainNo" label="车次"/><el-table-column label="区间" min-width="170"><template #default="{row}">{{ row.fromStationName }} → {{ row.toStationName }}</template></el-table-column><el-table-column prop="departureDateTime" label="出发时间" min-width="170"/><el-table-column prop="seatTypeName" label="席别"/><el-table-column label="座位"><template #default="{row}">{{ row.coachNo || '-' }}车 {{ row.seatNo || '-' }}</template></el-table-column><el-table-column prop="price" label="票价"/><el-table-column prop="status" label="状态"/></el-table><div style="margin-top:20px;text-align:right"><el-button v-if="detail.status==='PAID'" @click="router.push('/tickets/change')">退票 / 改签</el-button><el-button v-if="detail.status==='PENDING_PAYMENT'" type="warning" @click="router.push(`/payment/${detail.orderId}`)">继续支付</el-button><el-button type="primary" @click="router.push('/trains')">再订一程</el-button></div></template><el-skeleton v-else :rows="8" animated/></UserCenterShell></template>
