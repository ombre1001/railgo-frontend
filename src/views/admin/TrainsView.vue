<script setup lang="ts">
import axios from "axios";
import { onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "@/api";
import type { TrainSeatCoachTemplate } from "@/api";
import type { Station, TrainSyncLog, TrainSyncSummary } from "@/types/api";

type Row = Record<string, any>;
const list = ref<Row[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const query = reactive({
  page: 1,
  size: 20,
  keyword: "",
  trainType: "",
  status: "",
});
const dialog = ref(false);
const trainId = ref<number | null>(null);
const tab = ref("basic");
const form = reactive<Row>({
  trainNo: "",
  trainType: "G",
  fromStationId: undefined,
  toStationId: undefined,
  status: "ACTIVE",
});
const stops = ref<Row[]>([]);
const coaches = ref<Row[]>([]);
const fares = ref<Row[]>([]);
const stationOptions = ref<Station[]>([]);
const stationLoading = ref(false);
const stationCache = new Map<number, Station>();
const seatTypes = ref<Row[]>([]);
const syncDialog = ref(false);
const allSeatDialog = ref(false);
const allSeatLoading = ref(false);
const allSeatForm = reactive({
  overwrite: false,
  firstClassCoachCount: 1,
  firstClassRows: 10,
  secondClassCoachCount: 7,
  secondClassRows: 18,
});
const syncing = ref(false);
const syncTaskMayBeRunning = ref(false);
const syncRange = ref<[string, string]>([
  dayjs().format("YYYY-MM-DD"),
  dayjs().format("YYYY-MM-DD"),
]);

const syncSummary = ref<TrainSyncSummary | null>(null);

const syncLogs = ref<TrainSyncLog[]>([]);
const syncLogTotal = ref(0);
const syncLogLoading = ref(false);

const syncLogQuery = reactive({
  page: 1,
  size: 10,
});

interface TrainSyncErrorResponse {
  code?: number;
  message?: string;
  requestId?: string;
  timestamp?: string;
}

function rows<T>(data: { records?: T[]; list?: T[] }) {
  return data.records || data.list || [];
}
async function stationName(id: number) {
  if (!id) return "";
  if (!stationCache.has(id)) stationCache.set(id, await api.station.detail(id));
  return stationCache.get(id)?.name || String(id);
}
async function load() {
  loading.value = true;
  try {
    const data = await api.admin.trains(query);
    const records = rows<Row>(data);
    await Promise.all(
      records.flatMap((row) =>
        [Number(row.originStationId), Number(row.destinationStationId)]
          .filter(Boolean)
          .map(stationName),
      ),
    );
    list.value = records.map((row) => ({
      ...row,
      originStationName: stationCache.get(Number(row.originStationId))?.name,
      destinationStationName: stationCache.get(Number(row.destinationStationId))
        ?.name,
    }));
    total.value = Number(data.total || 0);
  } finally {
    loading.value = false;
  }
}
async function remoteStations(keyword: string) {
  stationLoading.value = true;
  try {
    stationOptions.value = keyword
      ? await api.station.suggest(keyword)
      : await api.station.hot();
  } finally {
    stationLoading.value = false;
  }
}
function addStationOption(station: Station) {
  stationCache.set(station.id, station);
  if (!stationOptions.value.some((item) => item.id === station.id))
    stationOptions.value.push(station);
}
async function resolveStations(ids: number[]) {
  await Promise.all(
    ids
      .filter(Boolean)
      .map(async (id) => addStationOption(await api.station.detail(id))),
  );
}
async function open(row?: Row, initialTab = "basic") {
  trainId.value = row ? Number(row.id) : null;
  tab.value = initialTab;
  Object.assign(form, {
    trainNo: "",
    trainType: "G",
    fromStationId: undefined,
    toStationId: undefined,
    status: "ACTIVE",
  });
  stops.value = [];
  coaches.value = [];
  fares.value = [];
  if (trainId.value) {
    const detail = await api.admin.trainDetail(trainId.value);
    Object.assign(form, {
      ...detail,
      fromStationId: detail.originStationId,
      toStationId: detail.destinationStationId,
    });
    await resolveStations([
      Number(detail.originStationId),
      Number(detail.destinationStationId),
    ]);
    await loadTab(initialTab);
  }
  dialog.value = true;
}
async function loadTab(name: string) {
  if (!trainId.value) return;
  if (name === "stops") {
    stops.value = await api.admin.trainStops(trainId.value);
    await resolveStations(stops.value.map((item) => Number(item.stationId)));
  } else if (name === "coaches")
    coaches.value = await api.admin.trainCoaches(trainId.value);
  else if (name === "fares")
    fares.value = await api.admin.trainFares(trainId.value);
}
async function save() {
  saving.value = true;
  try {
    if (tab.value === "basic") {
      const payload = {
        trainNo: form.trainNo,
        trainType: form.trainType,
        fromStationId: Number(form.fromStationId),
        toStationId: Number(form.toStationId),
        status: form.status,
      };
      if (trainId.value) await api.admin.updateTrain(trainId.value, payload);
      else {
        const created = await api.admin.createTrain(payload);
        trainId.value = Number(created.id);
      }
    } else if (tab.value === "stops" && trainId.value)
      await api.admin.saveTrainStops(
        trainId.value,
        stops.value.map(
          ({
            stationId,
            stopSeq,
            arrivalTime,
            arrivalDayOffset,
            departureTime,
            departureDayOffset,
            distanceKm,
          }) => ({
            stationId: Number(stationId),
            stopSeq: Number(stopSeq),
            arrivalTime: arrivalTime || null,
            arrivalDayOffset: Number(arrivalDayOffset || 0),
            departureTime: departureTime || null,
            departureDayOffset: Number(departureDayOffset || 0),
            distanceKm: Number(distanceKm || 0),
          }),
        ),
      );
    else if (tab.value === "coaches" && trainId.value)
      await api.admin.saveTrainCoaches(
        trainId.value,
        coaches.value.map(({ coachNo, seatTypeId }) => ({
          coachNo,
          seatTypeId: Number(seatTypeId),
        })),
      );
    else if (tab.value === "fares" && trainId.value)
      await api.admin.saveTrainFares(
        trainId.value,
        fares.value.map(({ fromSeq, toSeq, seatTypeId, price }) => ({
          fromSeq: Number(fromSeq),
          toSeq: Number(toSeq),
          seatTypeId: Number(seatTypeId),
          price: Number(price),
        })),
      );
    ElMessage.success("数据已保存到后端");
    await load();
  } finally {
    saving.value = false;
  }
}
async function generateSeats() {
  if (!trainId.value || !coaches.value.length)
    return ElMessage.warning("请先保存车厢编组");
  const result = await api.admin.generateSeats(trainId.value, {
    overwrite: false,
    templates: coaches.value.map((item) => ({
      coachNo: item.coachNo,
      startRow: 1,
      endRow: Math.max(1, Math.ceil(Number(item.capacity || 90) / 5)),
      seatLetters: ["A", "B", "C", "D", "F"],
    })),
  });
  ElMessage.success(`生成座位 ${Number(result.generatedCount || 0)} 个`);
  await loadTab("coaches");
}

function buildAllTrainSeatTemplates(): TrainSeatCoachTemplate[] {
  const templates: TrainSeatCoachTemplate[] = [];
  let coachIndex = 1;

  for (let index = 0; index < allSeatForm.firstClassCoachCount; index++) {
    templates.push({
      coachNo: String(coachIndex++).padStart(2, "0"),
      startRow: 1,
      endRow: Number(allSeatForm.firstClassRows),
      seatLetters: ["A", "C", "D", "F"],
    });
  }

  for (let index = 0; index < allSeatForm.secondClassCoachCount; index++) {
    templates.push({
      coachNo: String(coachIndex++).padStart(2, "0"),
      startRow: 1,
      endRow: Number(allSeatForm.secondClassRows),
      seatLetters: ["A", "B", "C", "D", "F"],
    });
  }

  return templates;
}

async function initializeAllTrainSeats() {
  const templates = buildAllTrainSeatTemplates();
  if (!templates.length) {
    return ElMessage.warning("至少配置一节车厢");
  }

  await ElMessageBox.confirm(
    allSeatForm.overwrite
      ? "覆盖模式会删除爬虫同步车次的原车厢和座位并重新生成，确定继续吗？"
      : "将只为爬虫同步且尚无车厢的车次批量生成车厢和座位，确定继续吗？",
    "批量生成座位",
    { type: allSeatForm.overwrite ? "warning" : "info" },
  );

  allSeatLoading.value = true;
  try {
    const result = await api.admin.initializeAllTrainSeats({
      overwrite: allSeatForm.overwrite,
      templates,
    });

    ElMessage.success(
      `共 ${Number(result.totalTrainCount || 0)} 个车次，初始化 ${Number(result.initializedTrainCount || 0)} 个，跳过 ${Number(result.skippedTrainCount || 0)} 个，生成 ${Number(result.generatedCoachCount || 0)} 节车厢、${Number(result.generatedSeatCount || 0)} 个座位`,
    );
    allSeatDialog.value = false;
    await load();
  } catch (error: unknown) {
    if (axios.isAxiosError<TrainSyncErrorResponse>(error)) {
      const backendMessage = error.response?.data?.message;

      if (
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT" ||
        error.message.toLowerCase().includes("timeout")
      ) {
        ElMessage.warning({
          message:
            "批量生成等待超时，但后端可能仍在写入座位。请勿重复提交，稍后刷新车次编组查看结果。",
          duration: 10000,
          showClose: true,
        });
        return;
      }

      ElMessage.error({
        message: backendMessage || error.message || "批量生成座位失败",
        duration: 8000,
        showClose: true,
      });
      return;
    }

    ElMessage.error("批量生成座位失败");
  } finally {
    allSeatLoading.value = false;
  }
}
function syncResultType(result: TrainSyncLog["result"]) {
  if (result === "SUCCESS") {
    return "success";
  }

  if (result === "PARTIAL") {
    return "warning";
  }

  if (result === "FAILED") {
    return "danger";
  }

  return "info";
}

function syncResultText(result: TrainSyncLog["result"]) {
  const texts: Record<TrainSyncLog["result"], string> = {
    RUNNING: "执行中",
    SUCCESS: "成功",
    PARTIAL: "部分成功",
    FAILED: "失败",
  };

  return texts[result];
}

async function loadSyncLogs() {
  syncLogLoading.value = true;

  try {
    const data = await api.admin.trainSyncLogs(syncLogQuery);

    syncLogs.value = rows<TrainSyncLog>(data);

    syncLogTotal.value = Number(data.total || 0);

    // 只使用最新一页判断任务状态。浏览旧日志页时不能把仍在执行的
    // 新任务错误地改成“已结束”。
    if (syncLogQuery.page === 1) {
      syncTaskMayBeRunning.value = syncLogs.value.some(
        (item) => item.result === "RUNNING",
      );
    }
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : "同步日志加载失败",
    );
  } finally {
    syncLogLoading.value = false;
  }
}

async function openSyncDialog() {
  syncDialog.value = true;
  syncSummary.value = null;
  syncLogQuery.page = 1;
  await loadSyncLogs();
}

function validateSyncRange(): boolean {
  if (!syncRange.value || syncRange.value.length !== 2) {
    ElMessage.warning("请选择同步开始日期和结束日期");
    return false;
  }

  const start = dayjs(syncRange.value[0]);
  const end = dayjs(syncRange.value[1]);

  if (!start.isValid() || !end.isValid() || end.isBefore(start, "day")) {
    ElMessage.warning("同步日期范围不合法");
    return false;
  }

  // 后端允许 startDate 到 startDate + 30天，
  // 即包含首尾日期最多31天。
  if (end.diff(start, "day") > 30) {
    ElMessage.warning("单次最多同步31天");
    return false;
  }

  return true;
}

async function startTrainSync(): Promise<void> {
  if (syncing.value) {
    ElMessage.warning("同步请求正在提交，请勿重复点击");
    return;
  }

  if (syncTaskMayBeRunning.value) {
    ElMessage.warning(
      "后端仍有车次同步任务正在执行，请先刷新日志确认任务已结束",
    );
    return;
  }

  if (!validateSyncRange()) {
    return;
  }

  const [startDate, endDate] = syncRange.value;

  try {
    await ElMessageBox.confirm(
      `确定同步 ${startDate} 至 ${endDate} 的车次、经停站和运行数据吗？同步期间请勿重复提交。`,
      "确认同步车次",
      {
        confirmButtonText: "开始同步",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
  } catch {
    return;
  }

  syncing.value = true;
  syncSummary.value = null;

  try {
    const result = await api.admin.syncTrains({
      startDate,
      endDate,
    });

    syncSummary.value = result;

    if (result.failedDays > 0) {
      ElMessage.warning(
        `同步完成：成功${result.successDays}天，失败${result.failedDays}天，请查看日志`,
      );
    } else {
      ElMessage.success(
        `同步完成：写入${result.trainCount}个车次、${result.stopCount}条经停记录`,
      );
    }
  } catch (error: unknown) {
    if (axios.isAxiosError<TrainSyncErrorResponse>(error)) {
      const status = error.response?.status;
      const backendMessage = error.response?.data?.message;

      if (status === 409) {
        syncTaskMayBeRunning.value = true;
        ElMessage.warning({
          message: backendMessage || "已有车次同步任务正在执行，请勿重复提交",
          duration: 8000,
          showClose: true,
        });
        return;
      }

      if (
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT" ||
        error.message.toLowerCase().includes("timeout")
      ) {
        // 浏览器停止等待并不会取消后端正在执行的同步任务。
        syncTaskMayBeRunning.value = true;
        ElMessage.warning({
          message:
            "前端等待已超时，但后端可能仍在同步。请勿再次提交，请刷新下方日志查看任务状态。",
          duration: 10000,
          showClose: true,
        });
        return;
      }

      if (status === 401) {
        ElMessage.error("登录状态已失效，请重新登录");
        return;
      }

      if (status === 403) {
        ElMessage.error("当前账号没有执行车次同步的权限");
        return;
      }

      ElMessage.error(backendMessage || error.message || "车次同步请求失败");
      return;
    }

    ElMessage.error(
      error instanceof Error ? error.message : "车次同步请求失败",
    );
  } finally {
    syncing.value = false;
    syncLogQuery.page = 1;

    // 刷新失败不能继续向外抛出，否则仍会出现Uncaught (in promise)。
    await Promise.allSettled([loadSyncLogs(), load()]);
  }
}
onMounted(async () => {
  seatTypes.value = await api.dictionary.seatTypes();
  stationOptions.value = await api.station.hot();
  stationOptions.value.forEach(addStationOption);
  await load();
});
</script>

<template>
  <div>
    <div class="page-heading">
      <div>
        <h1>车次与座席</h1>
        <p>车次、经停站、车厢与票价均通过管理接口维护</p>
      </div>

      <div>
        <el-button @click="openSyncDialog"> 同步车次 </el-button>

        <el-button type="primary" @click="open()"> 新增车次 </el-button>
      </div>
    </div>
    <section class="table-card surface">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="query.keyword"
            placeholder="车次号"
            clearable
            style="width: 210px"
            @keyup.enter="load"
          /><el-select
            v-model="query.trainType"
            clearable
            placeholder="车型"
            style="width: 120px"
            ><el-option
              v-for="type in ['G', 'D', 'C', 'Z', 'T', 'K', 'OTHER']"
              :key="type"
              :label="type"
              :value="type" /></el-select
          ><el-select
            v-model="query.status"
            clearable
            placeholder="状态"
            style="width: 130px"
            ><el-option label="启用" value="ACTIVE" /><el-option
              label="停用"
              value="INACTIVE" /></el-select
          ><el-button
            type="primary"
            @click="
              query.page = 1;
              load();
            "
            >查询</el-button
          >
        </div>
        <div class="toolbar-right">
          <el-button type="success" @click="allSeatDialog = true">
            批量生成座位
          </el-button>
        </div>
      </div>
      <el-table v-loading="loading" :data="list"
        ><el-table-column prop="id" label="ID" width="75" /><el-table-column
          prop="trainNo"
          label="车次号"
          width="110"
          ><template #default="{ row }"
            ><b style="color: var(--rg-blue)">{{ row.trainNo }}</b></template
          ></el-table-column
        ><el-table-column
          prop="trainType"
          label="类型"
          width="80"
        /><el-table-column
          prop="originStationName"
          label="始发站"
        /><el-table-column
          prop="destinationStationName"
          label="终到站"
        /><el-table-column prop="status" label="状态" width="110"
          ><template #default="{ row }"
            ><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{
              row.status
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="操作" width="250" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="open(row)"
              >基本信息</el-button
            ><el-button link @click="open(row, 'stops')">经停时刻</el-button
            ><el-button link @click="open(row, 'coaches')">编组</el-button
            ><el-button link @click="open(row, 'fares')"
              >票价</el-button
            ></template
          ></el-table-column
        ></el-table
      >
      <el-pagination
        v-model:current-page="query.page"
        :total="total"
        :page-size="query.size"
        layout="total, prev, pager, next"
        style="justify-content: flex-end; margin-top: 18px"
        @current-change="load"
      />
    </section>

    <el-dialog
      v-model="allSeatDialog"
      title="爬虫车次批量生成车厢与座位"
      width="620px"
    >
      <el-alert
        title="只处理爬虫同步入库的车次。默认生成1节一等座和7节二等座；非覆盖模式会跳过已有车厢的车次。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 18px"
      />
      <el-form label-width="150px">
        <el-form-item label="一等座车厢数">
          <el-input-number v-model="allSeatForm.firstClassCoachCount" :min="0" :max="8" />
        </el-form-item>
        <el-form-item label="一等座排数">
          <el-input-number v-model="allSeatForm.firstClassRows" :min="1" :max="50" />
          <span style="margin-left: 12px; color: var(--el-text-color-secondary)">每排 A/C/D/F</span>
        </el-form-item>
        <el-form-item label="二等座车厢数">
          <el-input-number v-model="allSeatForm.secondClassCoachCount" :min="0" :max="16" />
        </el-form-item>
        <el-form-item label="二等座排数">
          <el-input-number v-model="allSeatForm.secondClassRows" :min="1" :max="50" />
          <span style="margin-left: 12px; color: var(--el-text-color-secondary)">每排 A/B/C/D/F</span>
        </el-form-item>
        <el-form-item label="覆盖已有座位">
          <el-switch v-model="allSeatForm.overwrite" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="allSeatLoading" @click="allSeatDialog = false">取消</el-button>
        <el-button type="primary" :loading="allSeatLoading" @click="initializeAllTrainSeats">开始生成</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dialog"
      :title="trainId ? `配置车次 ${form.trainNo}` : '新增车次'"
      width="980"
    >
      <el-tabs v-model="tab" @tab-change="loadTab(String($event))">
        <el-tab-pane label="基本信息" name="basic"
          ><el-form :model="form" label-width="90px"
            ><div class="form-grid">
              <el-form-item label="车次号" required
                ><el-input v-model="form.trainNo" /></el-form-item
              ><el-form-item label="车型" required
                ><el-select v-model="form.trainType" style="width: 100%"
                  ><el-option
                    v-for="type in ['G', 'D', 'C', 'Z', 'T', 'K', 'OTHER']"
                    :key="type"
                    :value="type" /></el-select></el-form-item
              ><el-form-item label="始发站" required
                ><el-select
                  v-model="form.fromStationId"
                  filterable
                  remote
                  :remote-method="remoteStations"
                  :loading="stationLoading"
                  style="width: 100%"
                  ><el-option
                    v-for="station in stationOptions"
                    :key="station.id"
                    :label="station.name"
                    :value="station.id" /></el-select></el-form-item
              ><el-form-item label="终到站" required
                ><el-select
                  v-model="form.toStationId"
                  filterable
                  remote
                  :remote-method="remoteStations"
                  :loading="stationLoading"
                  style="width: 100%"
                  ><el-option
                    v-for="station in stationOptions"
                    :key="station.id"
                    :label="station.name"
                    :value="station.id" /></el-select></el-form-item
              ><el-form-item label="状态"
                ><el-select v-model="form.status" style="width: 100%"
                  ><el-option label="启用" value="ACTIVE" /><el-option
                    label="停用"
                    value="INACTIVE" /></el-select
              ></el-form-item></div></el-form
        ></el-tab-pane>
        <el-tab-pane label="经停站时刻" name="stops" :disabled="!trainId"
          ><el-table :data="stops"
            ><el-table-column label="站序" width="80"
              ><template #default="{ row }"
                ><el-input-number
                  v-model="row.stopSeq"
                  :min="1"
                  controls-position="right"
                  style="width: 70px" /></template></el-table-column
            ><el-table-column label="车站" min-width="180"
              ><template #default="{ row }"
                ><el-select
                  v-model="row.stationId"
                  filterable
                  remote
                  :remote-method="remoteStations"
                  style="width: 100%"
                  ><el-option
                    v-for="station in stationOptions"
                    :key="station.id"
                    :label="station.name"
                    :value="
                      station.id
                    " /></el-select></template></el-table-column
            ><el-table-column label="到达"
              ><template #default="{ row }"
                ><el-time-picker
                  v-model="row.arrivalTime"
                  value-format="HH:mm"
                  format="HH:mm"
                  placeholder="始发站可空"
                  style="width: 120px" /></template></el-table-column
            ><el-table-column label="发车"
              ><template #default="{ row }"
                ><el-time-picker
                  v-model="row.departureTime"
                  value-format="HH:mm"
                  format="HH:mm"
                  placeholder="终到站可空"
                  style="width: 120px" /></template></el-table-column
            ><el-table-column label="里程"
              ><template #default="{ row }"
                ><el-input-number
                  v-model="row.distanceKm"
                  :min="0"
                  controls-position="right"
                  style="width: 100px" /></template></el-table-column
            ><el-table-column width="65"
              ><template #default="{ $index }"
                ><el-button link type="danger" @click="stops.splice($index, 1)"
                  >删除</el-button
                ></template
              ></el-table-column
            ></el-table
          ><el-button
            style="margin-top: 14px"
            @click="
              stops.push({
                stopSeq: stops.length + 1,
                stationId: undefined,
                arrivalTime: null,
                arrivalDayOffset: 0,
                departureTime: null,
                departureDayOffset: 0,
                distanceKm: 0,
              })
            "
            >添加经停站</el-button
          ></el-tab-pane
        >
        <el-tab-pane label="车厢编组" name="coaches" :disabled="!trainId"
          ><el-table :data="coaches"
            ><el-table-column label="车厢号"
              ><template #default="{ row }"
                ><el-input v-model="row.coachNo" /></template></el-table-column
            ><el-table-column label="席别"
              ><template #default="{ row }"
                ><el-select v-model="row.seatTypeId" style="width: 100%"
                  ><el-option
                    v-for="seat in seatTypes"
                    :key="seat.id"
                    :label="seat.name || seat.seatTypeName || seat.code"
                    :value="seat.id" /></el-select></template></el-table-column
            ><el-table-column
              prop="capacity"
              label="当前容量"
            /><el-table-column width="65"
              ><template #default="{ $index }"
                ><el-button
                  link
                  type="danger"
                  @click="coaches.splice($index, 1)"
                  >删除</el-button
                ></template
              ></el-table-column
            ></el-table
          >
          <div style="margin-top: 14px">
            <el-button
              @click="
                coaches.push({
                  coachNo: String(coaches.length + 1).padStart(2, '0'),
                  seatTypeId: seatTypes[0]?.id,
                })
              "
              >添加车厢</el-button
            ><el-button type="primary" plain @click="generateSeats"
              >按当前编组生成座位</el-button
            >
          </div></el-tab-pane
        >
        <el-tab-pane label="区间票价" name="fares" :disabled="!trainId"
          ><el-table :data="fares"
            ><el-table-column label="起始站序"
              ><template #default="{ row }"
                ><el-input-number
                  v-model="row.fromSeq"
                  :min="1" /></template></el-table-column
            ><el-table-column label="到达站序"
              ><template #default="{ row }"
                ><el-input-number
                  v-model="row.toSeq"
                  :min="2" /></template></el-table-column
            ><el-table-column label="席别"
              ><template #default="{ row }"
                ><el-select v-model="row.seatTypeId" style="width: 100%"
                  ><el-option
                    v-for="seat in seatTypes"
                    :key="seat.id"
                    :label="seat.name || seat.seatTypeName || seat.code"
                    :value="seat.id" /></el-select></template></el-table-column
            ><el-table-column label="票价"
              ><template #default="{ row }"
                ><el-input-number
                  v-model="row.price"
                  :min="0"
                  :precision="2" /></template></el-table-column
            ><el-table-column width="65"
              ><template #default="{ $index }"
                ><el-button link type="danger" @click="fares.splice($index, 1)"
                  >删除</el-button
                ></template
              ></el-table-column
            ></el-table
          ><el-button
            style="margin-top: 14px"
            @click="
              fares.push({
                fromSeq: 1,
                toSeq: 2,
                seatTypeId: seatTypes[0]?.id,
                price: 0,
              })
            "
            >添加票价</el-button
          ></el-tab-pane
        >
      </el-tabs>
      <template #footer
        ><el-button @click="dialog = false">关闭</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存当前页</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="syncDialog"
      title="12306车次数据同步"
      width="980px"
      :close-on-click-modal="!syncing"
      :close-on-press-escape="!syncing"
      :show-close="!syncing"
    >
      <el-alert
        title="同步请求执行时间可能较长。请求结束前不要刷新页面或重复提交；后端会逐日记录同步日志。"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 18px"
      />

      <el-form inline>
        <el-form-item label="同步日期范围" required>
          <el-date-picker
            v-model="syncRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :clearable="false"
            :disabled="syncing || syncTaskMayBeRunning"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="syncing"
            :disabled="syncing || syncTaskMayBeRunning"
            @click="startTrainSync"
          >
            {{
              syncing
                ? "正在同步，请等待"
                : syncTaskMayBeRunning
                  ? "同步任务执行中"
                  : "开始同步"
            }}
          </el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="syncTaskMayBeRunning"
        title="后端可能仍在执行车次同步"
        description="409冲突或前端请求超时不表示后端任务已经停止。请勿重复提交，使用下方“刷新日志”确认任务状态。"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 18px"
      />

      <el-descriptions
        v-if="syncSummary"
        title="本次同步结果"
        :column="3"
        border
        style="margin-bottom: 22px"
      >
        <el-descriptions-item label="日期范围">
          {{ syncSummary.startDate }}
          至
          {{ syncSummary.endDate }}
        </el-descriptions-item>

        <el-descriptions-item label="成功天数">
          {{ syncSummary.successDays }}
        </el-descriptions-item>

        <el-descriptions-item label="失败天数">
          {{ syncSummary.failedDays }}
        </el-descriptions-item>

        <el-descriptions-item label="车次数量">
          {{ syncSummary.trainCount }}
        </el-descriptions-item>

        <el-descriptions-item label="经停记录">
          {{ syncSummary.stopCount }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="sync-log-heading">
        <h3>同步日志</h3>

        <el-button
          :loading="syncLogLoading"
          :disabled="syncing"
          @click="loadSyncLogs"
        >
          刷新日志
        </el-button>
      </div>

      <el-table v-loading="syncLogLoading" :data="syncLogs" row-key="id">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="sync-error-detail">
              <div>
                <b>批次号：</b>
                {{ row.batchId }}
              </div>

              <pre>{{ row.errorText || "本次同步没有错误信息" }}</pre>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="sourceDate" label="数据日期" width="115" />

        <el-table-column prop="source" label="数据源" min-width="150" />

        <el-table-column label="结果" width="105">
          <template #default="{ row }">
            <el-tag :type="syncResultType(row.result)">
              {{ syncResultText(row.result) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="trainCount" label="车次" width="80" />

        <el-table-column prop="stopCount" label="经停" width="80" />

        <el-table-column prop="startedAt" label="开始时间" min-width="165" />

        <el-table-column prop="finishedAt" label="结束时间" min-width="165">
          <template #default="{ row }">
            {{ row.finishedAt || "-" }}
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="syncLogQuery.page"
        :total="syncLogTotal"
        :page-size="syncLogQuery.size"
        layout="total, prev, pager, next"
        style="justify-content: flex-end; margin-top: 18px"
        @current-change="loadSyncLogs"
      />

      <template #footer>
        <el-button :disabled="syncing" @click="syncDialog = false">
          关闭
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sync-log-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sync-log-heading h3 {
  margin: 0;
}

.sync-error-detail {
  padding: 8px 56px 16px;
}

.sync-error-detail pre {
  max-height: 280px;
  margin: 12px 0 0;
  padding: 14px;
  overflow: auto;
  color: #b42318;
  white-space: pre-wrap;
  word-break: break-word;
  background: #fff5f5;
  border-radius: 8px;
}
</style>
