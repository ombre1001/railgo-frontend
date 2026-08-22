<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import type { OrderDetail } from '@/types/api'

const route = useRoute()
const router = useRouter()
const order = ref<OrderDetail | null>(null)
const remaining = ref(0)
const channel = ref('MOCK')
const paying = ref(false)
const success = ref(false)
const clock = computed(() => `${String(Math.floor(remaining.value / 60)).padStart(2, '0')}:${String(remaining.value % 60).padStart(2, '0')}`)
let timer = 0
onMounted(async () => {
  order.value = await api.order.detail(Number(route.params.orderId))
  remaining.value = Number(order.value.remainingSeconds || 0)
  timer = window.setInterval(() => { if (remaining.value > 0) remaining.value-- }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))
async function pay() {
  if (!order.value) return
  paying.value = true
  try {
    const payment = await api.order.pay(order.value.orderId, { channel: channel.value, clientRequestId: crypto.randomUUID() })
    await api.order.confirmPayment(String(payment.paymentNo))
    success.value = true
    ElMessage.success('支付确认成功，后端已完成出票')
  } finally { paying.value = false }
}
</script>

<template><section class="page-section"><div class="page-container" style="max-width:900px"><el-result v-if="success" icon="success" title="支付成功，电子票已生成" sub-title="支付创建与确认均已由后端处理"><template #extra><el-button type="primary" @click="router.push('/orders')">查看我的订单</el-button><el-button @click="router.push('/')">返回首页</el-button></template></el-result><div v-else-if="order" class="surface" style="padding:30px"><div class="section-title"><div><h2>订单待支付</h2><p>订单号 {{ order.orderNo }}</p></div><div>剩余支付时间 <b style="color:#ff6b00;font-size:24px">{{ clock }}</b></div></div><el-descriptions :column="2" border><el-descriptions-item label="订单状态">{{ order.status }}</el-descriptions-item><el-descriptions-item label="应付金额">¥{{ order.totalAmount }}</el-descriptions-item><el-descriptions-item label="失效时间">{{ order.expireAt }}</el-descriptions-item><el-descriptions-item label="乘车人">{{ (order.items || []).map(item => item.passengerName).join('、') }}</el-descriptions-item></el-descriptions><h3 style="margin-top:24px">支付渠道</h3><el-radio-group v-model="channel" style="display:grid;gap:12px"><el-radio v-for="item in ['MOCK','ALIPAY','WECHAT','BANK_CARD']" :key="item" :value="item" border size="large">{{ item }}</el-radio></el-radio-group><el-button type="warning" size="large" :loading="paying" :disabled="order.status!=='PENDING_PAYMENT'||remaining<=0" style="width:260px;float:right;margin-top:28px" @click="pay">确认支付 ¥{{ order.totalAmount }}</el-button><div style="clear:both"/></div><el-skeleton v-else :rows="7" animated/></div></section></template>
