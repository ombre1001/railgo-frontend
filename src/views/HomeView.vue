<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SearchPanel from '@/components/SearchPanel.vue'
import { api } from '@/api'
import type { Station } from '@/types/api'

const router = useRouter()
const hot = ref<Station[]>([])
onMounted(async () => { hot.value = await api.station.hot() })

function chooseStation(station: Station, field: 'from' | 'to') {
  router.replace({
    name: 'home',
    query: {
      ...router.currentRoute.value.query,
      [`${field}StationId`]: String(station.id),
      [`${field}Name`]: station.name
    }
  })
}

const services = [
  ['查', '智能余票查询', '直达与一次换乘'],
  ['座', '区间锁座', '避免超售并支持座位复用'],
  ['付', '模拟支付', '15分钟订单倒计时'],
  ['改', '在线退改签', '差价补付与自动退款']
]
</script>

<template>
  <section class="hero">
    <div class="hero-art" aria-hidden="true">
      <div class="hero-mountain" /><div class="hero-rail" />
      <div class="hero-train"><div class="hero-locomotive" /><div class="hero-coach" /><div class="hero-coach" /></div>
    </div>
    <div class="page-container hero-content">
      <div class="hero-copy">
        <div class="eyebrow">RAILGO · 智慧出行</div>
        <h1>从查询到出票，<br>每一程都清晰可控</h1>
        <p>覆盖直达、一次换乘、区间余票、模拟支付、退票与改签的完整火车票业务闭环。</p>
      </div>
      <SearchPanel />
    </div>
  </section>

  <section class="page-container service-strip surface">
    <div v-for="item in services" :key="item[0]" class="service-item">
      <div class="service-icon">{{ item[0] }}</div>
      <div><b>{{ item[1] }}</b><small>{{ item[2] }}</small></div>
    </div>
  </section>

  <section class="hot-routes">
    <div class="page-container">
      <div class="section-title"><div><h2>热门车站</h2><p>数据来自后端热门车站接口，可直接设为出发站或到达站</p></div></div>
      <div class="hot-route-grid">
        <article v-for="station in hot.slice(0, 8)" :key="station.id" class="route-card soft-surface">
          <strong>{{ station.name }}</strong>
          <span>{{ station.city || station.province || station.stationCode }}</span>
          <div style="margin-top:12px"><el-button size="small" @click="chooseStation(station, 'from')">设为出发站</el-button><el-button size="small" type="primary" plain @click="chooseStation(station, 'to')">设为到达站</el-button></div>
        </article>
      </div>
    </div>
  </section>

  <section class="page-section" style="background:#f4f8fd">
    <div class="page-container">
      <div class="section-title"><div><h2>可靠的售票业务流程</h2><p>页面数据和操作均连接 RailGo 后端接口</p></div></div>
      <div class="hot-route-grid">
        <div class="content-card surface"><b>01 查询</b><h3>实时聚合区间余票</h3><p class="muted">按运行日期、车站区间、席别聚合可售数量。</p></div>
        <div class="content-card surface"><b>02 锁座</b><h3>分配具体车厢座位</h3><p class="muted">下单后锁定跨越区间，未支付自动释放。</p></div>
        <div class="content-card surface"><b>03 出票</b><h3>幂等支付与电子票</h3><p class="muted">重复确认不会重复扣款，也不会重复出票。</p></div>
        <div class="content-card surface"><b>04 售后</b><h3>退票、退款与改签</h3><p class="muted">先锁新票再处理旧票，确保核心流程一致。</p></div>
      </div>
    </div>
  </section>
</template>
