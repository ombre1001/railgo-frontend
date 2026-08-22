<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { TrainRun } from '@/types/api'

const props = defineProps<{ run: TrainRun }>()
const router = useRouter()
const departure = computed(() => dayjs(props.run.departureDateTime).format('HH:mm'))
const arrival = computed(() => dayjs(props.run.arrivalDateTime).format('HH:mm'))
const minPrice = computed(() => Math.min(...props.run.fares.filter((fare) => fare.availableCount > 0).map((fare) => fare.price), Infinity))
const duration = computed(() => `${Math.floor(props.run.durationMinutes / 60)}时${props.run.durationMinutes % 60}分`)

type StationAwareTrainRun = TrainRun & {
  fromStationId?: number
  toStationId?: number
}

function positiveNumber(value: unknown): number {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : 0
}

const fromStationId = computed(() =>
  positiveNumber(
    (props.run as StationAwareTrainRun).fromStationId
  )
)

const toStationId = computed(() =>
  positiveNumber(
    (props.run as StationAwareTrainRun).toStationId
  )
)

function book() {
  if (!fromStationId.value || !toStationId.value) {
    ElMessage.error(
      '车次查询结果缺少实际出发站或到达站ID，请检查后端直达查询返回字段'
    )
    return
  }

  router.push({
    name: 'booking',
    query: {
      bookingMode: 'direct',
      runId: props.run.runId,
      fromStationId: fromStationId.value,
      toStationId: toStationId.value,
      trainNo: props.run.trainNo,
      fromName: props.run.fromStation,
      toName: props.run.toStation,
      departureDateTime: props.run.departureDateTime,
      arrivalDateTime: props.run.arrivalDateTime,
      durationMinutes: props.run.durationMinutes
    }
  })
}
</script>

<template>
  <article class="train-card soft-surface">
    <div class="train-journey">
      <div class="train-time"><strong>{{ departure }}</strong><span>{{ run.fromStation }}</span></div>
      <div class="route-line"><span>{{ duration }}</span><i /><small>{{ run.trainNo }}</small></div>
      <div class="train-time arrival"><strong>{{ arrival }}</strong><span>{{ run.toStation }}</span></div>
      <p class="train-terminal">始 {{ run.originStation || run.fromStation }} · 终 {{ run.terminalStation || run.toStation }}</p>
    </div>
    <div class="fare-list">
      <span v-for="fare in run.fares" :key="fare.seatTypeCode" class="fare-pill" :class="{ available: fare.availableCount > 5, scarce: fare.availableCount > 0 && fare.availableCount <= 5 }">
        {{ fare.seatTypeName }} {{ fare.availableCount > 0 ? `${fare.availableCount}张` : '无票' }} · ¥{{ fare.price }}
      </span>
    </div>
    <div class="train-action">
      <div><span class="price">¥{{ Number.isFinite(minPrice) ? minPrice : '--' }}</span><small> 起</small></div>
      <el-button type="warning" size="large" :disabled="!Number.isFinite(minPrice)" @click="book">预订</el-button>
    </div>
  </article>
</template>
