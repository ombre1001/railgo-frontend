<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import type { Station } from '@/types/api'

type StationField = 'from' | 'to'

interface StationSuggestion extends Station {
  value: string
}

const router = useRouter()
const route = useRoute()
const activeType = ref<'direct' | 'transfer'>('direct')

function queryText(value: unknown) {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}

function queryId(value: unknown) {
  const parsed = Number(queryText(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const form = reactive({
  fromStationId: queryId(route.query.fromStationId),
  toStationId: queryId(route.query.toStationId),
  fromName: queryText(route.query.fromStation) || queryText(route.query.fromName),
  toName: queryText(route.query.toStation) || queryText(route.query.toName),
  travelDate: queryText(route.query.travelDate) || dayjs().add(1, 'day').format('YYYY-MM-DD'),
  highSpeedOnly: queryText(route.query.highSpeedOnly) === 'true'
})

function syncFromRoute() {
  form.fromStationId = queryId(route.query.fromStationId)
  form.toStationId = queryId(route.query.toStationId)
  form.fromName = queryText(route.query.fromStation) || queryText(route.query.fromName)
  form.toName = queryText(route.query.toStation) || queryText(route.query.toName)
  form.travelDate = queryText(route.query.travelDate) || form.travelDate
  form.highSpeedOnly = queryText(route.query.highSpeedOnly) === 'true'
  activeType.value = route.query.mode === 'transfer' ? 'transfer' : 'direct'
}

async function resolveSelectedStation(field: StationField) {
  const idKey = field === 'from' ? 'fromStationId' : 'toStationId'
  const nameKey = field === 'from' ? 'fromName' : 'toName'
  const stationId = form[idKey]

  if (!stationId || form[nameKey].trim()) return

  try {
    const station = await api.station.detail(stationId)
    form[nameKey] = station.name
  } catch {
    form[idKey] = 0
  }
}

onMounted(async () => {
  syncFromRoute()
  await Promise.all([
    resolveSelectedStation('from'),
    resolveSelectedStation('to')
  ])
})

watch(
  () => route.query,
  async () => {
    syncFromRoute()
    await Promise.all([
      resolveSelectedStation('from'),
      resolveSelectedStation('to')
    ])
  },
  { deep: true }
)

async function queryStationSuggestions(
  keyword: string,
  callback: (suggestions: StationSuggestion[]) => void
) {
  try {
    const trimmedKeyword = keyword.trim()
    const stationList = trimmedKeyword
      ? await api.station.suggest(trimmedKeyword)
      : await api.station.hot()

    callback(
      stationList.map((station): StationSuggestion => ({
        ...station,
        value: station.name
      }))
    )
  } catch {
    callback([])
  }
}

function handleStationInput(field: StationField, value: string) {
  const idKey = field === 'from' ? 'fromStationId' : 'toStationId'
  const nameKey = field === 'from' ? 'fromName' : 'toName'

  form[nameKey] = value

  // 用户修改文字后清除旧 ID，提交时由后端按地名匹配全部车站。
  form[idKey] = 0
}

function selectStation(field: StationField, station: StationSuggestion) {
  if (field === 'from') {
    form.fromStationId = station.id
    form.fromName = station.name
    return
  }

  form.toStationId = station.id
  form.toName = station.name
}

function swap() {
  ;[form.fromStationId, form.toStationId] = [form.toStationId, form.fromStationId]
  ;[form.fromName, form.toName] = [form.toName, form.fromName]
}

function normalizeLocation(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/(特别行政区|自治州|地区|市|省|盟)$/, '')
    .toLowerCase()
}

function submit() {
  const fromName = form.fromName.trim()
  const toName = form.toName.trim()

  if (!fromName) {
    ElMessage.warning('请输入出发地')
    return
  }

  if (!toName) {
    ElMessage.warning('请输入到达地')
    return
  }

  if (
    form.fromStationId &&
    form.toStationId &&
    form.fromStationId === form.toStationId
  ) {
    ElMessage.warning('出发车站和到达车站不能相同')
    return
  }

  if (normalizeLocation(fromName) === normalizeLocation(toName)) {
    ElMessage.warning('出发地和到达地不能相同')
    return
  }

  if (!form.travelDate) {
    ElMessage.warning('请选择乘车日期')
    return
  }

  router.push({
    name: 'trains',
    query: {
      // 选择推荐项时传 ID；仅输入文字时传 fromStation/toStation。
      fromStationId: form.fromStationId ? String(form.fromStationId) : undefined,
      toStationId: form.toStationId ? String(form.toStationId) : undefined,
      fromStation: form.fromStationId ? undefined : fromName,
      toStation: form.toStationId ? undefined : toName,
      // fromName/toName 只用于页面回显。
      fromName,
      toName,
      travelDate: form.travelDate,
      mode: activeType.value,
      highSpeedOnly: String(form.highSpeedOnly)
    }
  })
}
</script>

<template>
  <div class="search-panel surface">
    <div class="search-tabs">
      <button type="button" class="search-tab" :class="{ active: activeType === 'direct' }" @click="activeType = 'direct'">
        单程直达
      </button>
      <button type="button" class="search-tab" :class="{ active: activeType === 'transfer' }" @click="activeType = 'transfer'">
        一次换乘
      </button>
    </div>

    <div class="search-row">
      <div class="search-field">
        <label>出发地</label>
        <el-autocomplete
          v-model="form.fromName"
          :fetch-suggestions="queryStationSuggestions"
          placeholder="输入城市、地区或车站名"
          clearable
          highlight-first-item
          :debounce="300"
          @input="handleStationInput('from', $event)"
          @select="selectStation('from', $event)"
        >
          <template #default="{ item }">
            <span>{{ item.name }}</span>
          </template>
        </el-autocomplete>
      </div>

      <button type="button" class="swap-button" aria-label="交换出发地和到达地" @click="swap">
        ⇄
      </button>

      <div class="search-field">
        <label>到达地</label>
        <el-autocomplete
          v-model="form.toName"
          :fetch-suggestions="queryStationSuggestions"
          placeholder="输入城市、地区或车站名"
          clearable
          highlight-first-item
          :debounce="300"
          @input="handleStationInput('to', $event)"
          @select="selectStation('to', $event)"
        >
          <template #default="{ item }">
            <span>{{ item.name }}</span>
          </template>
        </el-autocomplete>
      </div>

      <div class="search-field date-field">
        <label>出发日期</label>
        <el-date-picker
          v-model="form.travelDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY年MM月DD日"
          :clearable="false"
          style="width: 100%"
        />
      </div>

      <button type="button" class="search-submit" @click="submit">
        搜索车票
      </button>
    </div>

    <div class="search-options">
      <el-checkbox v-model="form.highSpeedOnly">
        只看高铁/动车
      </el-checkbox>
      <span>可直接输入城市或地区，搜索所在地全部车站</span>
    </div>
  </div>
</template>
