<script setup lang="ts">
import { ArrowRight, Connection, DataAnalysis, Lock, Monitor, Promotion, Refresh, Tickets } from '@element-plus/icons-vue'

const modules = [
  { icon: Tickets, title: '旅客购票服务', text: '直达与一次换乘查询、区间余票、选座锁座、订单支付及电子客票。' },
  { icon: Refresh, title: '退票与改签闭环', text: '支持退票预览、自动退款、差价计算和“先锁新票再处理旧票”的安全改签。' },
  { icon: Monitor, title: '运营管理后台', text: '集中维护车站、车次、座席、运行计划、库存、订单、资金与审计日志。' },
  { icon: DataAnalysis, title: '运营分析报表', text: '提供销售汇总、趋势、热门路线、上座率、用户统计和 CSV 导出。' }
]

const steps = [
  ['01', '车票查询', '按日期和区间查询直达／换乘方案，聚合各席别实时可售数量。'],
  ['02', '创建订单', '为每位乘车人分配具体座位，并对经过区间执行库存锁定。'],
  ['03', '支付出票', '支付操作以订单状态为准，重复确认不会重复扣款或重复出票。'],
  ['04', '售后处理', '退票释放库存并生成退款记录；改签完成差价支付或退款。']
]

const technologies = [
  ['前端', 'Vue 3 · TypeScript · Vite · Element Plus'],
  ['后端', 'Spring Boot · Spring Security · MyBatis-Plus'],
  ['数据层', 'MySQL · Redis · HikariCP 连接池'],
  ['可视化', 'ECharts · vue-echarts'],
  ['接口规范', 'RESTful API · JWT 双令牌 · 统一响应体']
]
</script>

<template>
  <section class="overview-hero">
    <div class="overview-grid-art" aria-hidden="true" />
    <div class="page-container overview-hero-inner">
      <div>
        <p class="overview-kicker">DATABASE COURSE PROJECT · SYSTEM SHOWCASE</p>
        <h1>RailGo 智慧铁路售票系统</h1>
        <p class="overview-lead">面向旅客购票与运营管理的全流程信息系统。以真实后端接口、结构化业务数据和完整订单状态流转，完成从数据同步到售后服务的业务闭环。</p>
        <div class="overview-actions">
          <RouterLink to="/trains"><el-button type="primary" size="large">开始车票查询<el-icon class="el-icon--right"><ArrowRight /></el-icon></el-button></RouterLink>
          <RouterLink to="/admin/login"><el-button size="large" plain>进入运营管理端</el-button></RouterLink>
        </div>
      </div>
      <aside class="overview-status-card surface">
        <div class="status-card-head"><span class="live-dot" />系统能力概览</div>
        <div class="overview-counts">
          <div><strong>2</strong><span>端协同：旅客端 / 管理端</span></div>
          <div><strong>4</strong><span>核心业务：查购付售后</span></div>
          <div><strong>5+</strong><span>技术组件协同支撑</span></div>
        </div>
        <div class="status-foot"><Connection /> 前端页面数据通过 REST API 由后端实时提供</div>
      </aside>
    </div>
  </section>

  <section class="page-section overview-section">
    <div class="page-container">
      <div class="section-title"><div><h2>系统功能全景</h2><p>以用户操作为主线，覆盖购票与运营两类核心角色</p></div></div>
      <div class="overview-module-grid">
        <article v-for="module in modules" :key="module.title" class="overview-module soft-surface">
          <el-icon><component :is="module.icon" /></el-icon>
          <div><h3>{{ module.title }}</h3><p>{{ module.text }}</p></div>
        </article>
      </div>
    </div>
  </section>

  <section class="overview-flow-section">
    <div class="page-container">
      <div class="section-title"><div><h2>核心业务流程</h2><p>订单、库存与资金记录由事务协同维护，保证售票流程可追溯</p></div></div>
      <div class="overview-flow">
        <article v-for="(step, index) in steps" :key="step[0]" class="overview-flow-step">
          <span class="flow-number">{{ step[0] }}</span>
          <div class="flow-line" v-if="index < steps.length - 1" />
          <h3>{{ step[1] }}</h3><p>{{ step[2] }}</p>
        </article>
      </div>
    </div>
  </section>

  <section class="page-section overview-section">
    <div class="page-container overview-architecture">
      <div class="overview-tech-card surface">
        <div class="section-title"><div><h2>技术架构</h2><p>前后端分离，接口层、业务层与数据层职责清晰</p></div></div>
        <div class="tech-stack-list">
          <div v-for="item in technologies" :key="item[0]"><b>{{ item[0] }}</b><span>{{ item[1] }}</span></div>
        </div>
      </div>
      <div class="overview-assurance-card">
        <p class="overview-kicker">QUALITY &amp; RELIABILITY</p>
        <h2>不仅完成页面，更关注可用性</h2>
        <ul>
          <li><Lock /> JWT 鉴权、角色权限控制与操作审计</li>
          <li><DataAnalysis /> MySQL 事务与行级锁，降低并发购票超售风险</li>
          <li><Refresh /> Redis 用于验证码时效、单次消费与发送限流</li>
          <li><Promotion /> 接入 12306 车站与车次数据源，并提供定时同步能力</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="overview-data-section">
    <div class="page-container overview-data-inner">
      <div><p class="overview-kicker">DATA SOURCE</p><h2>真实数据，完整链路</h2></div>
      <p>车站与车次基础数据可由 12306 数据源同步进入本地 MySQL；购票、支付、退改签和管理报表均基于系统业务数据实时计算。演示时可直接进入旅客端查询、下单，或进入管理端查看运行计划、订单与统计数据。</p>
    </div>
  </section>
</template>
