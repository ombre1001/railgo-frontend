<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { api } from '@/api'
import type { Fare, Passenger } from '@/types/api'

const route = useRoute()
const router = useRouter()

const passengers = ref<Passenger[]>([])
const directFares = ref<Fare[]>([])
const firstLegFares = ref<Fare[]>([])
const secondLegFares = ref<Fare[]>([])

const selectedPassengerIds = ref<number[]>([])

const directSeatType = ref('')
const firstSeatType = ref('')
const secondSeatType = ref('')

const directPreference = ref('NONE')
const firstPreference = ref('NONE')
const secondPreference = ref('NONE')

const loading = ref(false)
const submitting = ref(false)

const isTransfer = computed(
  () => route.query.bookingMode === 'transfer'
)

const directRunId = computed(
  () => positiveNumber(route.query.runId)
)

const firstRunId = computed(
  () => positiveNumber(route.query.firstRunId)
)

const secondRunId = computed(
  () => positiveNumber(route.query.secondRunId)
)

const fromStationId = computed(
  () => positiveNumber(route.query.fromStationId)
)

const transferStationId = computed(
  () => positiveNumber(route.query.transferStationId)
)

const toStationId = computed(
  () => positiveNumber(route.query.toStationId)
)

const directFare = computed(() => {
  return directFares.value.find(
    item => item.seatTypeCode === directSeatType.value
  )
})

const firstFare = computed(() => {
  return firstLegFares.value.find(
    item => item.seatTypeCode === firstSeatType.value
  )
})

const secondFare = computed(() => {
  return secondLegFares.value.find(
    item => item.seatTypeCode === secondSeatType.value
  )
})

const validRoute = computed(() => {
  if (isTransfer.value) {
    return (
      firstRunId.value > 0 &&
      secondRunId.value > 0 &&
      fromStationId.value > 0 &&
      transferStationId.value > 0 &&
      toStationId.value > 0
    )
  }

  return (
    directRunId.value > 0 &&
    fromStationId.value > 0 &&
    toStationId.value > 0
  )
})

const invalidRouteMessage = computed(() => {
  return isTransfer.value
    ? '缺少第一程运行、第二程运行、出发站、换乘站或到达站参数，请返回车票查询页重新选择。'
    : '缺少运行、出发站或到达站参数，请返回车票查询页重新选择。'
})

const total = computed(() => {
  const passengerCount =
    selectedPassengerIds.value.length

  if (isTransfer.value) {
    const singlePassengerPrice =
      Number(firstFare.value?.price || 0) +
      Number(secondFare.value?.price || 0)

    return singlePassengerPrice * passengerCount
  }

  return (
    Number(directFare.value?.price || 0) *
    passengerCount
  )
})

const canSubmit = computed(() => {
  if (!selectedPassengerIds.value.length) {
    return false
  }

  if (isTransfer.value) {
    return Boolean(
      firstFare.value &&
      secondFare.value
    )
  }

  return Boolean(directFare.value)
})

function positiveNumber(value: unknown): number {
  const actual = Array.isArray(value)
    ? value[0]
    : value

  const parsed = Number(actual)

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : 0
}

function queryText(name: string): string {
  const value = route.query[name]

  if (Array.isArray(value)) {
    return String(value[0] || '')
  }

  return String(value || '')
}

function formatDateTime(value: string): string {
  const parsed = dayjs(value)

  return parsed.isValid()
    ? parsed.format('YYYY-MM-DD HH:mm')
    : value
}

function firstAvailableSeatType(
  fares: Fare[]
): string {
  return fares.find(
    item => Number(item.availableCount) > 0
  )?.seatTypeCode || ''
}

function passengerName(
  passengerId: number
): string {
  return passengers.value.find(
    item => item.id === passengerId
  )?.name || ''
}

async function loadBookingData(): Promise<void> {
  if (!validRoute.value) {
    return
  }

  loading.value = true

  try {
    if (isTransfer.value) {
      const [
        passengerData,
        firstFareData,
        secondFareData
      ] = await Promise.all([
        api.user.passengers(),

        api.ticket.fares(
          firstRunId.value,
          {
            fromStationId:
              fromStationId.value,

            toStationId:
              transferStationId.value
          }
        ),

        api.ticket.fares(
          secondRunId.value,
          {
            fromStationId:
              transferStationId.value,

            toStationId:
              toStationId.value
          }
        )
      ])

      passengers.value = passengerData

      firstLegFares.value =
        firstFareData as unknown as Fare[]

      secondLegFares.value =
        secondFareData as unknown as Fare[]

      firstSeatType.value =
        firstAvailableSeatType(
          firstLegFares.value
        )

      secondSeatType.value =
        firstAvailableSeatType(
          secondLegFares.value
        )

      return
    }

    const [
      passengerData,
      fareData
    ] = await Promise.all([
      api.user.passengers(),

      api.ticket.fares(
        directRunId.value,
        {
          fromStationId:
            fromStationId.value,

          toStationId:
            toStationId.value
        }
      )
    ])

    passengers.value = passengerData

    directFares.value =
      fareData as unknown as Fare[]

    directSeatType.value =
      firstAvailableSeatType(
        directFares.value
      )
  } finally {
    loading.value = false
  }
}

async function submit(): Promise<void> {
  if (!validRoute.value) {
    ElMessage.warning(
      '订单参数不完整，请重新查询车票'
    )
    return
  }

  if (!selectedPassengerIds.value.length) {
    ElMessage.warning(
      '请选择至少一名乘车人'
    )
    return
  }

  if (!canSubmit.value) {
    ElMessage.warning(
      isTransfer.value
        ? '请选择两程均有余票的席别'
        : '请选择有余票的席别'
    )
    return
  }

  submitting.value = true

  try {
    const clientRequestId =
      crypto.randomUUID()

    const result = isTransfer.value
      ? await api.order.createTransfer({
          firstLeg: {
            runId:
              firstRunId.value,

            fromStationId:
              fromStationId.value,

            toStationId:
              transferStationId.value
          },

          secondLeg: {
            runId:
              secondRunId.value,

            fromStationId:
              transferStationId.value,

            toStationId:
              toStationId.value
          },

          items:
            selectedPassengerIds.value.map(
              passengerId => ({
                passengerId,

                firstSeatTypeCode:
                  firstSeatType.value,

                secondSeatTypeCode:
                  secondSeatType.value,

                firstSeatPreference:
                  firstPreference.value,

                secondSeatPreference:
                  secondPreference.value
              })
            ),

          clientRequestId
        })

      : await api.order.create({
          runId:
            directRunId.value,

          fromStationId:
            fromStationId.value,

          toStationId:
            toStationId.value,

          items:
            selectedPassengerIds.value.map(
              passengerId => ({
                passengerId,

                seatTypeCode:
                  directSeatType.value,

                seatPreference:
                  directPreference.value
              })
            ),

          clientRequestId
        })

    const orderId =
      Number(result.orderId)

    if (
      !Number.isFinite(orderId) ||
      orderId <= 0
    ) {
      throw new Error(
        '后端未返回有效的订单ID'
      )
    }

    ElMessage.success(
      isTransfer.value
        ? '两程座位已锁定，请在订单有效期内完成支付'
        : '座位已锁定，请在订单有效期内完成支付'
    )

    await router.push(
      `/payment/${orderId}`
    )
  } finally {
    submitting.value = false
  }
}

onMounted(loadBookingData)
</script>

<template>
  <section class="page-section">
    <div
      class="page-container"
      v-loading="loading"
    >
      <el-alert
        v-if="!validRoute"
        type="error"
        :closable="false"
        :title="invalidRouteMessage"
      >
        <template #default>
          <el-button
            type="primary"
            link
            @click="router.push('/trains')"
          >
            返回车票查询
          </el-button>
        </template>
      </el-alert>

      <template v-else>
        <el-steps
          :active="1"
          align-center
          class="booking-steps"
        >
          <el-step title="选择车次" />
          <el-step title="确认订单" />
          <el-step title="支付" />
          <el-step title="出票完成" />
        </el-steps>

        <div class="surface journey-summary">
          <template v-if="isTransfer">
            <div class="journey-leg">
              <el-tag type="warning">
                第一程
              </el-tag>

              <h2>
                {{ queryText('firstTrainNo') }} ·
                {{ queryText('fromName') }}
                →
                {{ queryText('transferName') }}
              </h2>

              <p>
                {{
                  formatDateTime(
                    queryText(
                      'firstDepartureDateTime'
                    )
                  )
                }}
                出发 ·
                {{
                  formatDateTime(
                    queryText(
                      'firstArrivalDateTime'
                    )
                  )
                }}
                到达
              </p>
            </div>

            <div class="transfer-wait">
              换乘
              {{ queryText('waitMinutes') }}
              分钟
            </div>

            <div class="journey-leg">
              <el-tag type="success">
                第二程
              </el-tag>

              <h2>
                {{ queryText('secondTrainNo') }} ·
                {{ queryText('transferName') }}
                →
                {{ queryText('toName') }}
              </h2>

              <p>
                {{
                  formatDateTime(
                    queryText(
                      'secondDepartureDateTime'
                    )
                  )
                }}
                出发 ·
                {{
                  formatDateTime(
                    queryText(
                      'secondArrivalDateTime'
                    )
                  )
                }}
                到达
              </p>
            </div>
          </template>

          <div
            v-else
            class="journey-leg"
          >
            <h2>
              {{ queryText('trainNo') }} ·
              {{ queryText('fromName') }}
              →
              {{ queryText('toName') }}
            </h2>

            <p>
              {{
                formatDateTime(
                  queryText(
                    'departureDateTime'
                  )
                )
              }}
              出发 ·
              {{
                formatDateTime(
                  queryText(
                    'arrivalDateTime'
                  )
                )
              }}
              到达
            </p>
          </div>
        </div>

        <div class="booking-layout">
          <div class="surface booking-form">
            <h3>1. 选择乘车人</h3>

            <el-checkbox-group
              v-model="selectedPassengerIds"
              class="passenger-list"
            >
              <el-checkbox
                v-for="passenger in passengers"
                :key="passenger.id"
                :value="passenger.id"
                border
              >
                <b>{{ passenger.name }}</b>
                &nbsp;
                {{ passenger.idNoMasked }}
                ·
                {{ passenger.passengerType }}
              </el-checkbox>
            </el-checkbox-group>

            <el-empty
              v-if="!passengers.length"
              description="暂无常用乘车人"
            >
              <el-button
                type="primary"
                @click="
                  router.push('/passengers')
                "
              >
                添加乘车人
              </el-button>
            </el-empty>

            <el-divider />

            <template v-if="isTransfer">
              <h3>
                2. 选择第一程席别与偏好
              </h3>

              <p class="muted leg-description">
                {{ queryText('firstTrainNo') }}
                ·
                {{ queryText('fromName') }}
                →
                {{ queryText('transferName') }}
              </p>

              <el-radio-group
                v-model="firstSeatType"
                class="fare-options"
              >
                <el-radio-button
                  v-for="item in firstLegFares"
                  :key="item.seatTypeCode"
                  :value="item.seatTypeCode"
                  :disabled="
                    Number(
                      item.availableCount
                    ) <= 0
                  "
                >
                  {{ item.seatTypeName }}
                  ¥{{ item.price }}
                  ·
                  {{
                    Number(
                      item.availableCount
                    ) > 0
                      ? `${item.availableCount}张`
                      : '无票'
                  }}
                </el-radio-button>
              </el-radio-group>

              <el-empty
                v-if="!firstLegFares.length"
                description="后端未返回第一程票价余票"
              />

              <div class="preference-row">
                <span class="muted">
                  第一程座位偏好：
                </span>

                <el-radio-group
                  v-model="firstPreference"
                >
                  <el-radio value="NONE">
                    不限
                  </el-radio>

                  <el-radio value="WINDOW">
                    靠窗
                  </el-radio>

                  <el-radio value="AISLE">
                    靠过道
                  </el-radio>
                </el-radio-group>
              </div>

              <el-divider />

              <h3>
                3. 选择第二程席别与偏好
              </h3>

              <p class="muted leg-description">
                {{ queryText('secondTrainNo') }}
                ·
                {{ queryText('transferName') }}
                →
                {{ queryText('toName') }}
              </p>

              <el-radio-group
                v-model="secondSeatType"
                class="fare-options"
              >
                <el-radio-button
                  v-for="item in secondLegFares"
                  :key="item.seatTypeCode"
                  :value="item.seatTypeCode"
                  :disabled="
                    Number(
                      item.availableCount
                    ) <= 0
                  "
                >
                  {{ item.seatTypeName }}
                  ¥{{ item.price }}
                  ·
                  {{
                    Number(
                      item.availableCount
                    ) > 0
                      ? `${item.availableCount}张`
                      : '无票'
                  }}
                </el-radio-button>
              </el-radio-group>

              <el-empty
                v-if="!secondLegFares.length"
                description="后端未返回第二程票价余票"
              />

              <div class="preference-row">
                <span class="muted">
                  第二程座位偏好：
                </span>

                <el-radio-group
                  v-model="secondPreference"
                >
                  <el-radio value="NONE">
                    不限
                  </el-radio>

                  <el-radio value="WINDOW">
                    靠窗
                  </el-radio>

                  <el-radio value="AISLE">
                    靠过道
                  </el-radio>
                </el-radio-group>
              </div>
            </template>

            <template v-else>
              <h3>2. 选择席别与偏好</h3>

              <el-radio-group
                v-model="directSeatType"
                class="fare-options"
              >
                <el-radio-button
                  v-for="item in directFares"
                  :key="item.seatTypeCode"
                  :value="item.seatTypeCode"
                  :disabled="
                    Number(
                      item.availableCount
                    ) <= 0
                  "
                >
                  {{ item.seatTypeName }}
                  ¥{{ item.price }}
                  ·
                  {{
                    Number(
                      item.availableCount
                    ) > 0
                      ? `${item.availableCount}张`
                      : '无票'
                  }}
                </el-radio-button>
              </el-radio-group>

              <el-empty
                v-if="!directFares.length"
                description="后端未返回该区间票价余票"
              />

              <div class="preference-row">
                <span class="muted">
                  座位偏好：
                </span>

                <el-radio-group
                  v-model="directPreference"
                >
                  <el-radio value="NONE">
                    不限
                  </el-radio>

                  <el-radio value="WINDOW">
                    靠窗
                  </el-radio>

                  <el-radio value="AISLE">
                    靠过道
                  </el-radio>
                </el-radio-group>
              </div>
            </template>
          </div>

          <aside class="surface fee-summary">
            <h3>费用明细</h3>

            <div
              v-for="
                passengerId
                in selectedPassengerIds
              "
              :key="passengerId"
              class="passenger-fee"
            >
              <b>
                {{ passengerName(passengerId) }}
              </b>

              <template v-if="isTransfer">
                <div>
                  <span>
                    第一程 ·
                    {{
                      firstFare?.seatTypeName
                      || '-'
                    }}
                  </span>

                  <b>
                    ¥{{
                      Number(
                        firstFare?.price || 0
                      ).toFixed(2)
                    }}
                  </b>
                </div>

                <div>
                  <span>
                    第二程 ·
                    {{
                      secondFare?.seatTypeName
                      || '-'
                    }}
                  </span>

                  <b>
                    ¥{{
                      Number(
                        secondFare?.price || 0
                      ).toFixed(2)
                    }}
                  </b>
                </div>
              </template>

              <div v-else>
                <span>
                  {{
                    directFare?.seatTypeName
                    || '-'
                  }}
                </span>

                <b>
                  ¥{{
                    Number(
                      directFare?.price || 0
                    ).toFixed(2)
                  }}
                </b>
              </div>
            </div>

            <el-empty
              v-if="
                !selectedPassengerIds.length
              "
              :image-size="70"
              description="请选择乘车人"
            />

            <el-divider />

            <div class="total-row">
              <b>应付总额</b>

              <span class="price">
                ¥{{ total.toFixed(2) }}
              </span>
            </div>

            <el-button
              class="rg-primary submit-button"
              type="primary"
              size="large"
              :loading="submitting"
              :disabled="!canSubmit"
              @click="submit"
            >
              {{
                isTransfer
                  ? '提交两程订单并锁座'
                  : '提交订单并锁座'
              }}
            </el-button>
          </aside>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.booking-steps {
  margin-bottom: 28px;
}

.journey-summary {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    auto
    minmax(0, 1fr);
  gap: 24px;
  align-items: center;
  padding: 24px;
  margin-bottom: 18px;
}

.journey-leg h2 {
  margin: 12px 0 8px;
  font-size: 21px;
}

.journey-leg p {
  margin: 0;
  color: var(--rg-muted);
}

.transfer-wait {
  padding: 8px 14px;
  color: var(--rg-primary);
  background: #eef6ff;
  border-radius: 999px;
  white-space: nowrap;
}

.booking-layout {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    330px;
  gap: 18px;
  align-items: start;
}

.booking-form,
.fee-summary {
  padding: 24px;
}

.passenger-list {
  display: grid;
  gap: 12px;
  margin: 18px 0;
}

.fare-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.leg-description {
  margin: 8px 0 16px;
}

.preference-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}

.fee-summary {
  position: sticky;
  top: 92px;
}

.passenger-fee {
  padding: 14px 0;
  border-bottom:
    1px solid var(--rg-border);
}

.passenger-fee > b {
  display: block;
  margin-bottom: 10px;
}

.passenger-fee > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: end;
}

.submit-button {
  width: 100%;
  margin-top: 20px;
}

@media (max-width: 900px) {
  .journey-summary,
  .booking-layout {
    grid-template-columns: 1fr;
  }

  .transfer-wait {
    width: max-content;
  }

  .fee-summary {
    position: static;
  }
}
</style>
