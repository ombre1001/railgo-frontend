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

const stateMachines = [
  {
    title: '订单状态', table: 'ticket_order',
    transitions: [
      ['PENDING_PAYMENT', '支付成功', 'PAID'],
      ['PENDING_PAYMENT', '主动取消', 'CANCELLED'],
      ['PENDING_PAYMENT', '15 分钟超时', 'EXPIRED'],
      ['PAID', '部分退票', 'PARTIALLY_REFUNDED'],
      ['PAID / PARTIALLY_REFUNDED', '全部退票', 'REFUNDED']
    ]
  },
  {
    title: '区间库存', table: 'seat_segment_inventory',
    transitions: [
      ['AVAILABLE', '下单锁座', 'LOCKED'],
      ['LOCKED', '支付出票', 'SOLD'],
      ['LOCKED', '取消或超时', 'AVAILABLE'],
      ['SOLD', '退票或完成改签', 'AVAILABLE']
    ]
  },
  {
    title: '车票状态', table: 'order_item',
    transitions: [
      ['LOCKED', '支付出票', 'ISSUED'],
      ['LOCKED', '订单取消', 'CANCELLED'],
      ['ISSUED', '退票完成', 'REFUNDED'],
      ['ISSUED', '改签完成', 'CHANGED'],
      ['CHANGE_LOCKED', '确认新票', 'ISSUED']
    ]
  },
  {
    title: '支付与改签', table: 'payment_record / change_record',
    transitions: [
      ['PROCESSING', '确认支付', 'SUCCESS'],
      ['PROCESSING', '订单过期', 'CLOSED'],
      ['WAITING_PAYMENT', '补差价', 'COMPLETED'],
      ['WAITING_CONFIRMATION', '确认改签', 'COMPLETED'],
      ['等待中', '取消或超时', 'CANCELLED / EXPIRED']
    ]
  }
]

const transactionActions = [
  ['下单', '创建订单和车票；按座位、运行实例与站序锁定全部经过区间。'],
  ['支付', '库存 LOCKED→SOLD、车票 LOCKED→ISSUED、订单→PAID、流水→SUCCESS。'],
  ['退票', '释放已售区间、车票→REFUNDED、生成退票及退款流水、汇总订单状态。'],
  ['改签', '先锁新票；确认后释放旧票、售出新票，并记录补款或退款差额。']
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

  <section class="page-section overview-section state-section">
    <div class="page-container">
      <div class="section-title">
        <div><h2>业务状态机</h2><p>每一次操作都有明确的前置状态与目标状态，非法流转由后端拒绝</p></div>
        <span class="state-legend"><i /> 状态更新均校验原状态</span>
      </div>
      <div class="state-machine-grid">
        <article v-for="machine in stateMachines" :key="machine.title" class="state-machine-card surface">
          <header><div><h3>{{ machine.title }}</h3><code>{{ machine.table }}</code></div><span>{{ machine.transitions.length }} 条规则</span></header>
          <div class="transition-list">
            <div v-for="transition in machine.transitions" :key="transition.join('-')" class="transition-row">
              <b class="state-pill state-from">{{ transition[0] }}</b>
              <span class="transition-action"><small>{{ transition[1] }}</small><i>→</i></span>
              <b class="state-pill state-to">{{ transition[2] }}</b>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section class="overview-database-section">
    <div class="page-container">
      <div class="section-title database-heading"><div><p class="overview-kicker">DATABASE BUSINESS LOGIC</p><h2>区间库存与事务一致性</h2><p>不是按整趟列车扣减数字，而是锁定具体座位经过的每一段线路</p></div></div>
      <div class="database-showcase">
        <div class="segment-demo">
          <div class="segment-route"><span>北京</span><i /><span>济南</span><i /><span>南京</span><i /><span>上海</span></div>
          <div class="seat-segments">
            <b>01A</b><span class="segment sold">SOLD</span><span class="segment sold">SOLD</span><span class="segment available">AVAILABLE</span>
          </div>
          <p>购买“北京→南京”只占用前两个区间，“南京→上海”仍可复用同一座位。</p>
          <div class="lock-note"><Lock /> 锁座时使用 <code>SELECT ... FOR UPDATE</code> 锁定区间行，并再次检查状态与更新行数。</div>
        </div>
        <div class="transaction-panel">
          <h3>一次业务操作，同一事务提交</h3>
          <div v-for="(action, index) in transactionActions" :key="action[0]" class="transaction-row">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <div><b>{{ action[0] }}</b><p>{{ action[1] }}</p></div>
          </div>
          <footer>任一步骤失败，相关数据库修改全部回滚，避免订单、库存与资金状态不一致。</footer>
        </div>
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
