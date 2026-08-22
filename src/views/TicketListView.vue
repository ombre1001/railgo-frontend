<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import SearchPanel from '@/components/SearchPanel.vue'
import TrainCard from '@/components/TrainCard.vue'
import { api } from '@/api'
import type {
  DirectTicketQuery,
  TicketLocationQuery,
  TransferTicketQuery
} from '@/api'
import type { TrainRun, TransferPlan } from '@/types/api'

type SortMode =
  | 'DEPARTURE_ASC'
  | 'DURATION_ASC'
  | 'PRICE_ASC'

type TimeRangeKey =
  | ''
  | '00:00-06:00'
  | '06:00-12:00'
  | '12:00-18:00'
  | '18:00-24:00'

interface TicketFilters {
  hasTickets: boolean
  types: string[]
  time: TimeRangeKey
  sort: SortMode
}

interface TimeRange {
  startMinute: number
  endMinute: number
  requestStart: string
  requestEnd: string
}

const TIME_RANGES: Record<
  Exclude<TimeRangeKey, ''>,
  TimeRange
> = {
  '00:00-06:00': {
    startMinute: 0,
    endMinute: 6 * 60,
    requestStart: '00:00',
    requestEnd: '05:59'
  },
  '06:00-12:00': {
    startMinute: 6 * 60,
    endMinute: 12 * 60,
    requestStart: '06:00',
    requestEnd: '11:59'
  },
  '12:00-18:00': {
    startMinute: 12 * 60,
    endMinute: 18 * 60,
    requestStart: '12:00',
    requestEnd: '17:59'
  },
  '18:00-24:00': {
    startMinute: 18 * 60,
    endMinute: 24 * 60,
    requestStart: '18:00',
    requestEnd: '23:59'
  }
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadSequence = ref(0)

const runs = ref<TrainRun[]>([])
const transfers = ref<TransferPlan[]>([])

const filters = reactive<TicketFilters>({
  hasTickets: true,
  types: [],
  time: '',
  sort: 'DEPARTURE_ASC'
})

const mode = computed(() => {
  return route.query.mode === 'transfer'
    ? 'transfer'
    : 'direct'
})

const date = computed(() => {
  return String(
    route.query.travelDate ||
    dayjs().add(1, 'day').format('YYYY-MM-DD')
  )
})

const dateItems = computed(() => {
  const selected = dayjs(date.value)
  const today = dayjs().startOf('day')
  const preferredStart = selected.subtract(1, 'day')

  const start = preferredStart.isBefore(today)
    ? today
    : preferredStart

  return Array.from(
    { length: 7 },
    (_, index) => start.add(index, 'day').locale('zh-cn')
  )
})

const fromStationName = computed(() => String(
  route.query.fromName ||
  runs.value[0]?.fromStation ||
  transfers.value[0]?.firstLeg.fromStation ||
  '请选择出发站'
))

const toStationName = computed(() => String(
  route.query.toName ||
  runs.value[0]?.toStation ||
  transfers.value[0]?.secondLeg.toStation ||
  '请选择到达站'
))

function routeText(value: unknown): string {
  return String(
    Array.isArray(value)
      ? value[0] || ''
      : value || ''
  ).trim()
}

function stationId(value: unknown): number {
  const parsed = Number(
    Array.isArray(value) ? value[0] : value
  )

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : 0
}

function runStationId(
  run: TrainRun,
  field: 'fromStationId' | 'toStationId'
): number {
  const stationAwareRun = run as TrainRun & {
    fromStationId?: number
    toStationId?: number
  }

  return stationId(stationAwareRun[field])
}

function selectedTimeRange(): TimeRange | undefined {
  if (!filters.time) {
    return undefined
  }

  return TIME_RANGES[filters.time]
}

/**
 * 构造后端请求参数。
 *
 * 直达接口支持：
 * departureTimeStart、departureTimeEnd、sort。
 *
 * 换乘接口的排序字段与直达接口不同，
 * 因此需要转换排序字段。
 */
function buildLocationParams(): TicketLocationQuery {
  const fromStationId = stationId(
    route.query.fromStationId
  )

  const toStationId = stationId(
    route.query.toStationId
  )

  const fromStation =
    routeText(route.query.fromStation) ||
    routeText(route.query.fromName)

  const toStation =
    routeText(route.query.toStation) ||
    routeText(route.query.toName)

  return {
    fromStationId: fromStationId || undefined,
    toStationId: toStationId || undefined,
    fromStation: fromStationId
      ? undefined
      : fromStation || undefined,
    toStation: toStationId
      ? undefined
      : toStation || undefined,
    travelDate: date.value
  }
}

function hasRequiredLocation(
  params: TicketLocationQuery
): boolean {
  const hasFrom = Boolean(
    params.fromStationId || params.fromStation
  )

  const hasTo = Boolean(
    params.toStationId || params.toStation
  )

  return hasFrom && hasTo && Boolean(params.travelDate)
}

function buildTransferParams(
  baseParams: TicketLocationQuery
): TransferTicketQuery {
  const transferSortMap: Record<
    SortMode,
    NonNullable<TransferTicketQuery['sort']>
  > = {
    DEPARTURE_ASC: 'DEPARTURE_ASC',
    DURATION_ASC: 'TOTAL_DURATION_ASC',
    PRICE_ASC: 'TOTAL_PRICE_ASC'
  }

  return {
    ...baseParams,
    sort: transferSortMap[filters.sort]
  }
}

function buildDirectParams(
  baseParams: TicketLocationQuery
): DirectTicketQuery {

  const selectedTypes = filters.types.length
    ? filters.types
    : route.query.highSpeedOnly === 'true'
      ? ['G', 'D']
      : []

  const range = selectedTimeRange()

  return {
    ...baseParams,

    trainTypes: selectedTypes.length
      ? selectedTypes.join(',')
      : undefined,

    departureTimeStart: range?.requestStart,
    departureTimeEnd: range?.requestEnd,

    sort: filters.sort
  }
}

async function load(): Promise<void> {
  const sequence = ++loadSequence.value

  loading.value = true
  runs.value = []
  transfers.value = []

  try {
    const locationParams = buildLocationParams()

    if (!hasRequiredLocation(locationParams)) {
      return
    }

    if (mode.value === 'direct') {
      const data = await api.ticket.direct(
        buildDirectParams(locationParams)
      )

      if (sequence === loadSequence.value) {
        runs.value = Array.isArray(data)
          ? data
          : data.records || data.list || []
      }
    } else {
      const data = await api.ticket.transfers(
        buildTransferParams(locationParams)
      )

      if (sequence === loadSequence.value) {
        transfers.value = Array.isArray(data)
          ? data
          : data.records || data.list || []
      }
    }
  } catch {
    if (sequence === loadSequence.value) {
      runs.value = []
      transfers.value = []
    }
  } finally {
    if (sequence === loadSequence.value) {
      loading.value = false
    }
  }
}

function selectDate(value: string): void {
  if (value === date.value) {
    return
  }

  router.replace({
    name: 'trains',
    query: {
      ...route.query,
      travelDate: value
    }
  })
}

function transferBookable(plan: TransferPlan): boolean {
  return plan.transferStationId > 0
    && runStationId(plan.firstLeg, 'fromStationId') > 0
    && runStationId(plan.secondLeg, 'toStationId') > 0
    && hasAvailableTicket(plan.firstLeg)
    && hasAvailableTicket(plan.secondLeg)
}

function bookTransfer(plan: TransferPlan): void {
  router.push({
    name: 'booking',
    query: {
      bookingMode: 'transfer',

      firstRunId: plan.firstLeg.runId,
      secondRunId: plan.secondLeg.runId,

      fromStationId: runStationId(
        plan.firstLeg,
        'fromStationId'
      ),
      transferStationId: plan.transferStationId,
      toStationId: runStationId(
        plan.secondLeg,
        'toStationId'
      ),

      firstTrainNo: plan.firstLeg.trainNo,
      secondTrainNo: plan.secondLeg.trainNo,

      fromName: plan.firstLeg.fromStation,
      transferName: plan.transferStation,
      toName: plan.secondLeg.toStation,

      firstDepartureDateTime:
        plan.firstLeg.departureDateTime,

      firstArrivalDateTime:
        plan.firstLeg.arrivalDateTime,

      secondDepartureDateTime:
        plan.secondLeg.departureDateTime,

      secondArrivalDateTime:
        plan.secondLeg.arrivalDateTime,

      waitMinutes: plan.waitMinutes
    }
  })
}

/**
 * 将出发时间转换成当天分钟数。
 * 例如 15:42 转换为 942。
 */
function departureMinute(dateTime: string): number {
  const parsed = dayjs(dateTime)

  if (!parsed.isValid()) {
    return -1
  }

  return parsed.hour() * 60 + parsed.minute()
}

/**
 * 用于出发时间升序排序。
 */
function departureTimestamp(dateTime: string): number {
  const value = dayjs(dateTime).valueOf()

  return Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER
}

/**
 * 前端再次根据后端返回的真实 departureDateTime 过滤。
 *
 * 后端请求也会携带开始时间和结束时间，
 * 这里再次过滤，避免后端部署版本未实现时间条件时
 * 页面仍然显示错误区间的数据。
 */
function isInSelectedTimeRange(
  dateTime: string
): boolean {
  const range = selectedTimeRange()

  if (!range) {
    return true
  }

  const minute = departureMinute(dateTime)

  return (
    minute >= range.startMinute &&
    minute < range.endMinute
  )
}

function hasAvailableTicket(run: TrainRun): boolean {
  return (run.fares || []).some(
    fare => Number(fare.availableCount) > 0
  )
}

/**
 * 获取该车次当前有票席别中的最低价格。
 * 无票席别不参与最低价格排序。
 */
function minimumAvailablePrice(
  run: TrainRun
): number {
  const prices = (run.fares || [])
    .filter(
      fare => Number(fare.availableCount) > 0
    )
    .map(
      fare => Number(fare.price)
    )
    .filter(
      price => Number.isFinite(price)
    )

  return prices.length
    ? Math.min(...prices)
    : Number.POSITIVE_INFINITY
}

function directRunComparator(
  left: TrainRun,
  right: TrainRun
): number {
  const departureDifference =
    departureTimestamp(left.departureDateTime) -
    departureTimestamp(right.departureDateTime)

  if (filters.sort === 'DURATION_ASC') {
    const durationDifference =
      Number(left.durationMinutes) -
      Number(right.durationMinutes)

    return durationDifference || departureDifference
  }

  if (filters.sort === 'PRICE_ASC') {
    const priceDifference =
      minimumAvailablePrice(left) -
      minimumAvailablePrice(right)

    return priceDifference || departureDifference
  }

  return departureDifference
}

function transferPlanComparator(
  left: TransferPlan,
  right: TransferPlan
): number {
  const departureDifference =
    departureTimestamp(
      left.firstLeg.departureDateTime
    ) -
    departureTimestamp(
      right.firstLeg.departureDateTime
    )

  if (filters.sort === 'DURATION_ASC') {
    const durationDifference =
      Number(left.totalDurationMinutes) -
      Number(right.totalDurationMinutes)

    return durationDifference || departureDifference
  }

  if (filters.sort === 'PRICE_ASC') {
    const priceDifference =
      Number(left.minimumTotalPrice) -
      Number(right.minimumTotalPrice)

    return priceDifference || departureDifference
  }

  return departureDifference
}

/**
 * 直达车次最终展示结果：
 *
 * 1. 有票筛选
 * 2. 车型筛选
 * 3. 出发时间筛选
 * 4. 出发时间/运行时长/最低价格排序
 */
const filteredRuns = computed<TrainRun[]>(() => {
  return runs.value
    .filter(
      run =>
        !filters.hasTickets ||
        hasAvailableTicket(run)
    )
    .filter(
      run =>
        !filters.types.length ||
        filters.types.includes(run.trainType)
    )
    .filter(
      run =>
        isInSelectedTimeRange(
          run.departureDateTime
        )
    )
    .slice()
    .sort(directRunComparator)
})

/**
 * 换乘方案同样支持：
 *
 * 1. 第一程出发时间筛选
 * 2. 总运行时长排序
 * 3. 总价格排序
 */
const filteredTransfers = computed<TransferPlan[]>(() => {
  return transfers.value
    .filter(
      plan =>
        !filters.hasTickets ||
        (
          hasAvailableTicket(plan.firstLeg) &&
          hasAvailableTicket(plan.secondLeg)
        )
    )
    .filter(
      plan =>
        isInSelectedTimeRange(
          plan.firstLeg.departureDateTime
        )
    )
    .slice()
    .sort(transferPlanComparator)
})

function resetFilters(): void {
  filters.hasTickets = true
  filters.types = []
  filters.time = ''
  filters.sort = 'DEPARTURE_ASC'
}

/**
 * 查询条件、日期、排序或者时间发生变化时，
 * 重新调用真实后端接口。
 */
watch(
  () => [
    route.fullPath,
    filters.types,
    filters.sort,
    filters.time
  ],
  load,
  {
    deep: true,
    immediate: true
  }
)
</script>

<template>
  <section class="page-section">
    <div class="page-container ticket-results-container">
      <div class="list-search-bar surface">
        <SearchPanel />
      </div>

      <div class="section-title results-heading">
        <div>
          <h2>
            {{ fromStationName }} → {{ toStationName }}
          </h2>

          <p>
            {{ date }} ·
            {{
              mode === 'direct'
                ? `共 ${filteredRuns.length} 趟直达车次`
                : `共 ${filteredTransfers.length} 个换乘方案`
            }}
          </p>
        </div>
      </div>

      <div class="list-layout">
        <div class="results-main">
          <div
            class="date-strip"
            aria-label="选择出发日期"
          >
            <button
              v-for="item in dateItems"
              :key="item.format('YYYY-MM-DD')"
              type="button"
              class="date-item"
              :class="{
                active:
                  item.format('YYYY-MM-DD') === date
              }"
              :aria-pressed="
                item.format('YYYY-MM-DD') === date
              "
              @click="
                selectDate(
                  item.format('YYYY-MM-DD')
                )
              "
            >
              <b>{{ item.format('MM月DD日') }}</b>
              <span>{{ item.format('ddd') }}</span>
            </button>
          </div>

          <div class="sort-strip">
            <el-radio-group
              v-model="filters.sort"
              size="large"
            >
              <el-radio-button value="DEPARTURE_ASC">
                出发 早→晚
              </el-radio-button>

              <el-radio-button value="DURATION_ASC">
                运行时长
              </el-radio-button>

              <el-radio-button value="PRICE_ASC">
                价格最低
              </el-radio-button>
            </el-radio-group>
          </div>

          <div
            v-loading="loading"
            class="results-list"
          >
            <template v-if="mode === 'direct'">
              <TrainCard
                v-for="run in filteredRuns"
                :key="
                  `${run.runId}-${runStationId(run, 'fromStationId')}-${runStationId(run, 'toStationId')}`
                "
                :run="run"
              />

              <el-empty
                v-if="
                  !loading &&
                  !filteredRuns.length
                "
                :description="
                  !hasRequiredLocation(buildLocationParams())
                    ? '请选择出发站和到达站后查询'
                    : '暂未查询到符合条件的车次'
                "
              />
            </template>

            <template v-else>
              <article
                v-for="plan in filteredTransfers"
                :key="
                  `${plan.firstLeg.runId}-${plan.secondLeg.runId}-${runStationId(plan.firstLeg, 'fromStationId')}-${plan.transferStationId}-${runStationId(plan.secondLeg, 'toStationId')}`
                "
                class="transfer-card soft-surface"
              >
                <div>
                  <el-tag type="warning">
                    第一程
                  </el-tag>

                  <h3>
                    {{ plan.firstLeg.trainNo }} ·
                    {{ plan.firstLeg.fromStation }}
                    →
                    {{ plan.transferStation }}
                  </h3>

                  <p>
                    {{
                      plan.firstLeg.departureDateTime
                        .slice(11, 16)
                    }}
                    —
                    {{
                      plan.firstLeg.arrivalDateTime
                        .slice(11, 16)
                    }}
                  </p>
                </div>

                <div>
                  <span class="muted">
                    换乘 {{ plan.waitMinutes }} 分钟
                  </span>

                  <h3>
                    {{ plan.secondLeg.trainNo }} ·
                    {{ plan.transferStation }}
                    →
                    {{ plan.secondLeg.toStation }}
                  </h3>

                  <p>
                    {{
                      plan.secondLeg.departureDateTime
                        .slice(11, 16)
                    }}
                    —
                    {{
                      plan.secondLeg.arrivalDateTime
                        .slice(11, 16)
                    }}
                  </p>
                </div>

                <div class="train-action">
                <div>
                  <span class="price">
                    ¥{{ plan.minimumTotalPrice }}
                  </span>
                  <small> 起</small>
                </div>

                <el-button
                  type="warning"
                  size="large"
                  :disabled="!transferBookable(plan)"
                  @click="bookTransfer(plan)"
                >
                  预订
                </el-button>
              </div>
              </article>

              <el-empty
                v-if="
                  !loading &&
                  !filteredTransfers.length
                "
                description="暂未查询到符合条件的换乘方案"
              />
            </template>
          </div>
        </div>

        <aside class="filter-panel surface">
          <div class="filter-title">
            <h3>筛选</h3>

            <el-button
              text
              @click="resetFilters"
            >
              全部重置
            </el-button>
          </div>

          <div class="filter-section">
            <el-checkbox v-model="filters.hasTickets">
              仅显示有票车次
            </el-checkbox>
          </div>

          <div class="filter-section">
            <h4>车型</h4>

            <el-checkbox-group
              v-model="filters.types"
              class="filter-grid"
            >
              <el-checkbox value="G">
                高铁 G
              </el-checkbox>

              <el-checkbox value="D">
                动车 D
              </el-checkbox>

              <el-checkbox value="Z">
                直达 Z
              </el-checkbox>

              <el-checkbox value="K">
                快速 K
              </el-checkbox>
            </el-checkbox-group>
          </div>

          <div class="filter-section">
            <h4>出发时间</h4>

            <el-radio-group
              v-model="filters.time"
              class="filter-time"
            >
              <el-radio value="">
                不限
              </el-radio>

              <el-radio value="00:00-06:00">
                00:00—06:00
              </el-radio>

              <el-radio value="06:00-12:00">
                06:00—12:00
              </el-radio>

              <el-radio value="12:00-18:00">
                12:00—18:00
              </el-radio>

              <el-radio value="18:00-24:00">
                18:00—24:00
              </el-radio>
            </el-radio-group>
          </div>
        </aside>
      </div>
    </div>
  </section>
</template>

<style scoped>
.list-search-bar :deep(.search-panel) {
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  box-shadow: none;
}
</style>
