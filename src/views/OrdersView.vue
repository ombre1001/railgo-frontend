<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import UserCenterShell from '@/components/UserCenterShell.vue'
import { api } from '@/api'
import type { OrderSummary } from '@/types/api'

const router=useRouter();const loading=ref(false);const list=ref<OrderSummary[]>([]);const filters=reactive({status:'',keyword:'',page:1,size:10})
const labels:Record<string,{text:string,type:string}>={PENDING_PAYMENT:{text:'待支付',type:'warning'},PAID:{text:'已支付',type:'success'},CANCELLED:{text:'已取消',type:'info'},REFUNDED:{text:'已退票',type:'danger'}}
async function load(){loading.value=true;try{const data=await api.order.list(filters);list.value=data.records||data.list||[]}finally{loading.value=false}}
async function cancel(id:number){await api.order.cancel(id);ElMessage.success('订单已取消');load()}
onMounted(load)
</script>

<template><UserCenterShell><div class="section-title"><div><h2>我的火车票订单</h2><p>查询近30天订单，查看支付、退票和改签状态</p></div></div><el-tabs v-model="filters.status" class="status-tabs" @tab-change="load"><el-tab-pane label="全部订单" name=""/><el-tab-pane label="待支付" name="PENDING_PAYMENT"/><el-tab-pane label="已支付" name="PAID"/><el-tab-pane label="已取消" name="CANCELLED"/></el-tabs><div class="toolbar"><el-input v-model="filters.keyword" placeholder="订单号 / 车次 / 乘车人" clearable style="width:260px"/><el-button type="primary" @click="load">查询</el-button></div><div v-loading="loading"><article v-for="order in list" :key="order.orderId" class="order-card soft-surface"><div class="order-head"><span>{{ order.createdAt }}　订单号：{{ order.orderNo }}</span><span>RailGo 火车票</span></div><div class="order-body"><div class="order-route"><strong>{{ order.fromStationName }} → {{ order.toStationName }}</strong><p>{{ order.trainNos }} · {{ order.firstTravelDate }} · {{ order.passengerCount }}位乘车人</p></div><div><el-tag :type="(labels[order.status]?.type as any)||'info'">{{ labels[order.status]?.text||order.status }}</el-tag><p v-if="order.status==='PENDING_PAYMENT'" class="muted">请尽快完成支付</p></div><div><span class="price">¥{{ order.totalAmount }}</span></div><div><el-button type="primary" link @click="router.push(`/orders/${order.orderId}`)">订单详情</el-button><el-button v-if="order.status==='PENDING_PAYMENT'" type="danger" link @click="cancel(order.orderId)">取消</el-button></div></div></article><el-empty v-if="!list.length" description="暂无相关订单"/></div></UserCenterShell></template>
