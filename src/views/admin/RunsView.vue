<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'

type Row = Record<string, any>
const list = ref<Row[]>([])
const trains = ref<Row[]>([])
const total = ref(0)
const loading = ref(false)
const allOnSaleLoading = ref(false)
const queryRange = ref<[string, string]>([dayjs().format('YYYY-MM-DD'), dayjs().add(30, 'day').format('YYYY-MM-DD')])
const query = reactive({ page: 1, size: 20, trainId: undefined as number | undefined, saleStatus: '' })
const batchDialog = ref(false)
const batchRange = ref<[string, string]>([dayjs().format('YYYY-MM-DD'), dayjs().add(6, 'day').format('YYYY-MM-DD')])
const batchForm = reactive({ trainId: undefined as number | undefined, initializeInventory: false })
const inventoryBatchDialog = ref(false)
const inventoryBatchLoading = ref(false)
const inventoryBatchRange = ref<[string, string]>([dayjs().format('YYYY-MM-DD'), dayjs().add(6, 'day').format('YYYY-MM-DD')])
const inventoryBatchForm = reactive({ trainId: undefined as number | undefined })
const inventoryDialog = ref(false)
const inventoryRows = ref<Row[]>([])
const inventoryRun = ref<Row | null>(null)
const statuses = ['DRAFT', 'NOT_ON_SALE', 'ON_SALE', 'OFF_SALE', 'CANCELLED']

function recordsOf(data: Row) {
  return data.records || data.list || []
}

function displayTrainNo(row: Row) {
  const directTrainNo = row.trainNo || row.train_no
  if (directTrainNo) return directTrainNo

  const runTrainId = row.trainId ?? row.train_id
  const train = trains.value.find(item => Number(item.id) === Number(runTrainId))
  return train?.trainNo || train?.train_no || '—'
}

async function loadTrains() {
  const size = 100
  const firstPage = await api.admin.trains({ page: 1, size })
  const firstRecords = recordsOf(firstPage)
  const pageCount = Math.max(
    Number(firstPage.pages || 1),
    Math.ceil(Number(firstPage.total || firstRecords.length) / size),
  )

  if (pageCount <= 1) {
    trains.value = firstRecords
    return
  }

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      api.admin.trains({ page: index + 2, size }),
    ),
  )

  trains.value = [
    ...firstRecords,
    ...remainingPages.flatMap(recordsOf),
  ]
}
async function load() {
  loading.value = true
  try {
    const data = await api.admin.runs({ ...query, startDate: queryRange.value?.[0], endDate: queryRange.value?.[1] })
    list.value = data.records || data.list || []
    total.value = Number(data.total || 0)
  } finally { loading.value = false }
}
async function updateStatus(row: Row, value: string) {
  await api.admin.updateRunStatus(Number(row.id), value)
  ElMessage.success(`运行 ${row.id} 状态已更新为 ${value}`)
  await load()
}
async function initInventory(row: Row) {
  await ElMessageBox.confirm(`确定初始化运行 ${row.id}（${displayTrainNo(row)}）的区间库存吗？`, '初始化库存')
  await api.admin.initializeInventory(Number(row.id))
  ElMessage.success('区间库存初始化完成')
  await load()
}
async function showInventory(row: Row) {
  inventoryRun.value = row
  inventoryRows.value = await api.admin.inventory(Number(row.id))
  inventoryDialog.value = true
}
async function createRuns() {
  if (!batchForm.trainId || !batchRange.value?.length) return ElMessage.warning('请选择车次和日期范围')
  const result = await api.admin.createRuns({ trainId: batchForm.trainId, startDate: batchRange.value[0], endDate: batchRange.value[1], initializeInventory: batchForm.initializeInventory })
  ElMessage.success(`已生成 ${Number(result.createdCount || 0)} 个运行实例`)
  batchDialog.value = false
  await load()
}

function openInventoryBatchDialog() {
  inventoryBatchForm.trainId = query.trainId
  inventoryBatchRange.value = queryRange.value
    ? [...queryRange.value] as [string, string]
    : [dayjs().format('YYYY-MM-DD'), dayjs().add(6, 'day').format('YYYY-MM-DD')]
  inventoryBatchDialog.value = true
}

async function initializeInventoryBatch() {
  if (!inventoryBatchRange.value?.length) {
    return ElMessage.warning('请选择日期范围')
  }

  const [startDate, endDate] = inventoryBatchRange.value
  await ElMessageBox.confirm(
    `确定初始化 ${startDate} 至 ${endDate} 的未初始化运行库存吗？`,
    '批量初始化库存',
    { type: 'warning' },
  )

  inventoryBatchLoading.value = true
  try {
    const result = await api.admin.batchInitializeInventory({
      trainId: inventoryBatchForm.trainId || null,
      startDate,
      endDate,
    })

    const summary = `匹配 ${Number(result.totalRunCount || 0)} 个，成功 ${Number(result.initializedRunCount || 0)} 个，跳过 ${Number(result.skippedRunCount || 0)} 个，失败 ${Number(result.failedRunCount || 0)} 个`

    if (Number(result.failedRunCount || 0) > 0) {
      const failureText = (result.failures || [])
        .slice(0, 10)
        .map((item: Row) => `${item.trainNo || item.trainId} / ${item.runDate}：${item.reason}`)
        .join('\n')
      await ElMessageBox.alert(`${summary}\n\n${failureText}`, '批量初始化结果', {
        type: 'warning',
      })
    } else {
      ElMessage.success(summary)
    }

    inventoryBatchDialog.value = false
    await load()
  } finally {
    inventoryBatchLoading.value = false
  }
}

async function setAllRunsOnSale() {
  if (allOnSaleLoading.value) {
    ElMessage.warning('一键开售任务正在执行，请勿重复提交')
    return
  }

  try {
    await ElMessageBox.confirm(
      [
        '确定将全部符合条件的运行计划设为 ON_SALE 吗？',
        '',
        '只有已经初始化库存的运行计划才会开售。',
        '未初始化库存和已取消的运行计划会自动跳过。',
      ].join('\n'),
      '一键全部开售',
      {
        type: 'warning',
        confirmButtonText: '确认全部开售',
        cancelButtonText: '取消',
        distinguishCancelAndClose: true,
      },
    )
  } catch {
    return
  }

  allOnSaleLoading.value = true

  try {
    /*
     * request()已经将统一响应体中的data取出，
     * 因此这里直接得到AllRunOnSaleResult。
     */
    const result = await api.admin.setAllRunsOnSale()

    const summary = [
      `运行计划总数：${Number(result.totalRunCount || 0)}`,
      `本次成功开售：${Number(result.updatedCount || 0)}`,
      `原本已经开售：${Number(result.alreadyOnSaleCount || 0)}`,
      `未初始化库存跳过：${Number(result.inventoryNotInitializedCount || 0)}`,
      `已取消跳过：${Number(result.cancelledCount || 0)}`,
    ].join('\n')

    if (Number(result.inventoryNotInitializedCount || 0) > 0) {
      await ElMessageBox.alert(
        summary,
        '一键开售完成',
        {
          type: 'warning',
          confirmButtonText: '确定',
        },
      )
    } else {
      ElMessage.success(
        `一键开售完成，本次成功开售 ${Number(result.updatedCount || 0)} 个运行计划`,
      )
    }

    query.page = 1
    await load()
  } catch (error: any) {
    console.error('一键全部开售失败', error)

    ElMessage.error(
      error?.response?.data?.message
      || error?.message
      || '一键全部开售失败',
    )
  } finally {
    allOnSaleLoading.value = false
  }
}
onMounted(async () => { await loadTrains(); await load() })
</script>

<template>
  <div>
    <div class="page-heading">
  <div>
    <h1>运行计划与库存</h1>
    <p>运行状态、库存初始化标记和席别库存均来自后端</p>
  </div>

  <div>
    <el-button
      type="success"
      :loading="allOnSaleLoading"
      :disabled="allOnSaleLoading || inventoryBatchLoading"
      @click="setAllRunsOnSale"
    >
      一键全部开售
    </el-button>

    <el-button
      type="primary"
      :disabled="allOnSaleLoading"
      @click="batchDialog = true"
    >
      生成运行计划
    </el-button>
  </div>
</div>
    <section class="table-card surface">
      <div class="toolbar"><div class="toolbar-left"><el-date-picker v-model="queryRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" :clearable="false"/><el-select v-model="query.trainId" filterable clearable placeholder="车次" style="width:160px"><el-option v-for="train in trains" :key="train.id" :label="train.trainNo" :value="train.id"/></el-select><el-select v-model="query.saleStatus" clearable placeholder="售票状态" style="width:155px"><el-option v-for="status in statuses" :key="status" :label="status" :value="status"/></el-select><el-button type="primary" @click="query.page=1;load()">查询</el-button></div><div class="toolbar-right">
  <el-button
    type="success"
    plain
    :disabled="allOnSaleLoading"
    @click="openInventoryBatchDialog"
  >
    批量初始化库存
  </el-button>
</div></div>
      <el-table v-loading="loading" :data="list"><el-table-column prop="id" label="运行ID" width="90"/><el-table-column label="车次" width="120"><template #default="{row}">{{ displayTrainNo(row) }}</template></el-table-column><el-table-column prop="runDate" label="运行日期" width="130"/><el-table-column label="售票状态" min-width="180"><template #default="{row}"><el-select :model-value="row.saleStatus" size="small" @change="updateStatus(row, String($event))"><el-option v-for="status in statuses" :key="status" :label="status" :value="status"/></el-select></template></el-table-column><el-table-column label="库存状态" width="130"><template #default="{row}"><el-tag :type="row.inventoryInitialized?'success':'info'">{{ row.inventoryInitialized ? '已初始化' : '未初始化' }}</el-tag></template></el-table-column><el-table-column prop="inventoryInitializedAt" label="初始化时间" min-width="175"/><el-table-column label="操作" width="190" fixed="right"><template #default="{row}"><el-button link type="primary" :disabled="row.inventoryInitialized" @click="initInventory(row)">初始化库存</el-button><el-button link :disabled="!row.inventoryInitialized" @click="showInventory(row)">库存明细</el-button></template></el-table-column></el-table>
      <el-pagination v-model:current-page="query.page" :total="total" :page-size="query.size" layout="total, prev, pager, next" style="justify-content:flex-end;margin-top:18px" @current-change="load"/>
    </section>

    <el-dialog v-model="batchDialog" title="生成运行实例" width="560"><el-form label-width="100px"><el-form-item label="车次" required><el-select v-model="batchForm.trainId" filterable style="width:100%"><el-option v-for="train in trains" :key="train.id" :label="train.trainNo" :value="train.id"/></el-select></el-form-item><el-form-item label="日期范围" required><el-date-picker v-model="batchRange" type="daterange" value-format="YYYY-MM-DD" style="width:100%"/></el-form-item><el-form-item label="同步库存"><el-switch v-model="batchForm.initializeInventory" active-text="生成后初始化库存"/></el-form-item></el-form><template #footer><el-button @click="batchDialog=false">取消</el-button><el-button type="primary" @click="createRuns">生成</el-button></template></el-dialog>

    <el-dialog v-model="inventoryBatchDialog" title="批量初始化运行库存" width="560"><el-alert title="只处理未初始化且状态为 DRAFT 或 NOT_ON_SALE 的运行计划；已初始化或已开售的运行会自动跳过。" type="info" :closable="false" show-icon style="margin-bottom:18px"/><el-form label-width="100px"><el-form-item label="车次"><el-select v-model="inventoryBatchForm.trainId" filterable clearable placeholder="全部车次" style="width:100%"><el-option v-for="train in trains" :key="train.id" :label="train.trainNo" :value="train.id"/></el-select></el-form-item><el-form-item label="日期范围" required><el-date-picker v-model="inventoryBatchRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" style="width:100%"/></el-form-item></el-form><template #footer><el-button :disabled="inventoryBatchLoading" @click="inventoryBatchDialog=false">取消</el-button><el-button type="primary" :loading="inventoryBatchLoading" @click="initializeInventoryBatch">开始初始化</el-button></template></el-dialog>

    <el-dialog v-model="inventoryDialog" :title="`库存明细 · 运行 ${inventoryRun?.id || ''}`" width="820"><el-table :data="inventoryRows"><el-table-column prop="seatTypeCode" label="席别代码"/><el-table-column prop="seatTypeName" label="席别名称"/><el-table-column prop="totalSegmentCount" label="总区间"/><el-table-column prop="availableSegmentCount" label="可售"/><el-table-column prop="lockedSegmentCount" label="锁定"/><el-table-column prop="soldSegmentCount" label="已售"/></el-table><el-empty v-if="!inventoryRows.length" description="后端未返回库存汇总数据"/></el-dialog>
  </div>
</template>
