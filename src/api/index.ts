import { download, request } from './http'
import type {
  AuthResponse,
  OrderDetail,
  OrderSummary,
  PageData,
  Passenger,
  SalesSummary,
  Station,
  TrainRun,
  TrainSyncLog,
  TrainSyncSummary,
  TransferPlan,
  UserProfile
} from '@/types/api'

type Params = Record<string, unknown>

export interface TrainSeatCoachTemplate {
  coachNo: string
  startRow: number
  endRow: number
  seatLetters: string[]
}

export interface InitializeAllTrainSeatsRequest {
  overwrite: boolean
  templates: TrainSeatCoachTemplate[]
}

export interface InitializeAllTrainSeatsResult {
  totalTrainCount: number
  initializedTrainCount: number
  skippedTrainCount: number
  generatedCoachCount: number
  generatedSeatCount: number
}

export interface BatchInitializeInventoryRequest {
  trainId: number | null
  startDate: string
  endDate: string
}

export interface InventoryBatchFailure {
  runId: number
  trainId: number
  trainNo: string
  runDate: string
  reason: string
}

export interface BatchInitializeInventoryResult {
  totalRunCount: number
  initializedRunCount: number
  skippedRunCount: number
  failedRunCount: number
  failures: InventoryBatchFailure[]
}

export interface AllRunOnSaleResult {
  totalRunCount: number
  updatedCount: number
  alreadyOnSaleCount: number
  inventoryNotInitializedCount: number
  cancelledCount: number
}

export interface TicketLocationQuery {
  fromStationId?: number
  toStationId?: number
  fromStation?: string
  toStation?: string
  travelDate: string
}

export interface DirectTicketQuery extends TicketLocationQuery {
  trainTypes?: string
  departureTimeStart?: string
  departureTimeEnd?: string
  sort?: 'DEPARTURE_ASC' | 'DEPARTURE_DESC' | 'DURATION_ASC' | 'PRICE_ASC'
}

export interface TransferTicketQuery extends TicketLocationQuery {
  minTransferMinutes?: number
  maxTransferMinutes?: number
  sort?: 'TOTAL_DURATION_ASC' | 'TOTAL_PRICE_ASC' | 'WAIT_TIME_ASC' | 'DEPARTURE_ASC'
}


export const api = {
  auth: {
    login: (payload: { account: string; password: string }) => request<AuthResponse>({ method: 'POST', url: '/auth/login', data: payload }),
    sendEmailCode: (payload: { email: string }) => request<void>({ method: 'POST', url: '/auth/email/code', data: payload }),
    register: (payload: Params) => request<AuthResponse>({ method: 'POST', url: '/auth/register', data: payload }),
    logout: (refreshToken: string) => request<void>({ method: 'POST', url: '/auth/logout', data: { refreshToken } })
  },
  user: {
    profile: () => request<UserProfile>({ url: '/users/me' }),
    updateProfile: (payload: Params) => request<UserProfile>({ method: 'PUT', url: '/users/me', data: payload }),
    changePassword: (payload: Params) => request<void>({ method: 'PUT', url: '/users/me/password', data: payload }),
    passengers: () => request<Passenger[]>({ url: '/users/me/passengers' }),
    createPassenger: (payload: Params) => request<Passenger>({ method: 'POST', url: '/users/me/passengers', data: payload }),
    updatePassenger: (id: number, payload: Params) => request<Passenger>({ method: 'PUT', url: `/users/me/passengers/${id}`, data: payload }),
    removePassenger: (id: number) => request<void>({ method: 'DELETE', url: `/users/me/passengers/${id}` })
  },
  station: {
    hot: (limit = 12) => request<Station[]>({ url: '/stations/hot', params: { limit } }),
    suggest: (keyword: string, limit = 10) => request<Station[]>({ url: '/stations/suggest', params: { keyword, limit } }),
    detail: (id: number) => request<Station>({ url: `/stations/${id}` })
  },
  dictionary: {
    seatTypes: () => request<Params[]>({ url: '/dictionaries/seat-types' }),
    trainTypes: () => request<Params[]>({ url: '/dictionaries/train-types' })
  },
  ticket: {
    direct: (params: DirectTicketQuery) => request<PageData<TrainRun> | TrainRun[]>({ url: '/tickets/direct', params }),
    transfers: (params: TransferTicketQuery) => request<PageData<TransferPlan> | TransferPlan[]>({ url: '/tickets/transfers', params }),
    stops: (runId: number) => request<Params[]>({ url: `/tickets/runs/${runId}/stops` }),
    fares: (runId: number, params: Params) => request<Params[]>({ url: `/tickets/runs/${runId}/fares`, params })
  },
  order: {
    create: (payload: Params) => request<Params>({ method: 'POST', url: '/orders', data: payload }),
    createTransfer: (payload: Params) => request<Params>({ method: 'POST', url: '/orders/transfer', data: payload }),
    list: (params: Params) => request<PageData<OrderSummary>>({ url: '/orders', params }),
    detail: (id: number) => request<OrderDetail>({ url: `/orders/${id}` }),
    cancel: (id: number) => request<Params>({ method: 'POST', url: `/orders/${id}/cancel` }),
    pay: (id: number, payload: Params) => request<Params>({ method: 'POST', url: `/orders/${id}/pay`, data: payload }),
    confirmPayment: (paymentNo: string) => request<Params>({ method: 'POST', url: `/payments/${paymentNo}/confirm` })
  },
  afterSales: {
    tickets: (params: Params = {}) => request<PageData<Params>>({ url: '/tickets', params }),
    returnPreview: (ticketId: number) => request<Params>({ url: `/tickets/${ticketId}/return-preview` }),
    returnTicket: (ticketId: number) => request<Params>({ method: 'POST', url: `/tickets/${ticketId}/return`, data: { clientRequestId: crypto.randomUUID() } }),
    changeOptions: (ticketId: number, travelDate: string) => request<Params[]>({ url: `/tickets/${ticketId}/change-options`, params: { travelDate } }),
    changePreview: (ticketId: number, payload: Params) => request<Params>({ method: 'POST', url: `/tickets/${ticketId}/change-preview`, data: payload }),
    confirmChange: (changeId: number) => request<Params>({ method: 'POST', url: `/changes/${changeId}/confirm` }),
    payChange: (changeId: number) => request<Params>({ method: 'POST', url: `/changes/${changeId}/pay` }),
    cancelChange: (changeId: number) => request<Params>({ method: 'POST', url: `/changes/${changeId}/cancel` })
  },
  admin: {
    salesSummary: (params: Params) => request<SalesSummary>({ url: '/admin/reports/sales-summary', params }),
    salesTrend: (params: Params) => request<Params[]>({ url: '/admin/reports/sales-trend', params }),
    popularRoutes: (params: Params) => request<Params[]>({ url: '/admin/reports/popular-routes', params }),
    loadFactor: (params: Params) => request<Params[]>({ url: '/admin/reports/load-factor', params }),
    userStatistics: (params: Params) => request<Params>({ url: '/admin/reports/users', params }),
    exportReport: (params: Params) => download({ url: '/admin/reports/export', params }, 'railgo-report.csv'),

    stations: (params: Params) => request<PageData<Station>>({ url: '/admin/stations', params }),
    stationDetail: (id: number) => request<Station>({ url: `/admin/stations/${id}` }),
    createStation: (payload: Params) => request<Station>({ method: 'POST', url: '/admin/stations', data: payload }),
    updateStation: (id: number, payload: Params) => request<Station>({ method: 'PUT', url: `/admin/stations/${id}`, data: payload }),
    updateStationStatus: (id: number, status: 'ACTIVE' | 'INACTIVE') => request<void>({ method: 'PATCH', url: `/admin/stations/${id}/status`, data: { status } }),

    trains: (params: Params) => request<PageData<Params>>({ url: '/admin/trains', params }),
    trainDetail: (id: number) => request<Params>({ url: `/admin/trains/${id}` }),
    createTrain: (payload: Params) => request<Params>({ method: 'POST', url: '/admin/trains', data: payload }),
    updateTrain: (id: number, payload: Params) => request<Params>({ method: 'PUT', url: `/admin/trains/${id}`, data: payload }),
    trainStops: (id: number) => request<Params[]>({ url: `/admin/trains/${id}/stops` }),
    saveTrainStops: (id: number, stops: Params[]) => request<void>({ method: 'PUT', url: `/admin/trains/${id}/stops`, data: { stops } }),
    trainCoaches: (id: number) => request<Params[]>({ url: `/admin/trains/${id}/coaches` }),
    saveTrainCoaches: (id: number, coaches: Params[]) => request<void>({ method: 'PUT', url: `/admin/trains/${id}/coaches`, data: { coaches } }),
    generateSeats: (id: number, payload: Params) => request<Params>({ method: 'POST', url: `/admin/trains/${id}/seats/generate`, data: payload }),
    initializeAllTrainSeats: (payload: InitializeAllTrainSeatsRequest) =>
      request<InitializeAllTrainSeatsResult>({
        method: 'POST',
        url: '/admin/trains/seats/init-all',
        data: payload,
        // 全部车次会生成大量车厢和座位记录，不能使用全局 15 秒超时。
        timeout: 10 * 60 * 1000
      }),
    trainFares: (id: number) => request<Params[]>({ url: `/admin/trains/${id}/fares` }),
    saveTrainFares: (id: number, fares: Params[]) => request<void>({ method: 'PUT', url: `/admin/trains/${id}/fares`, data: { fares } }),
    syncTrains: (
      payload: {
        startDate: string
        endDate: string
      }
    ) =>
      request<TrainSyncSummary>({
        method: 'POST',
        url: '/admin/train-sync',
        data: payload,
        timeout: 0
      }),

    trainSyncLogs: (
      params: {
        page: number
        size: number
      }
    ) =>
      request<PageData<TrainSyncLog>>({
        url: '/admin/train-sync/logs',
        params
      }),


    runs: (params: Params) => request<PageData<Params>>({ url: '/admin/train-runs', params }),
    createRuns: (payload: Params) => request<Params>({ method: 'POST', url: '/admin/train-runs/batch', data: payload }),
    updateRunStatus: (id: number, saleStatus: string) => request<void>({ method: 'PATCH', url: `/admin/train-runs/${id}/sale-status`, data: { saleStatus } }),
    setAllRunsOnSale: () =>
      request<AllRunOnSaleResult>({
        method: 'PATCH',
        url: '/admin/train-runs/sale-status/on-sale-all',
        timeout: 60 * 1000
      }),
    initializeInventory: (id: number) => request<void>({ method: 'POST', url: `/admin/train-runs/${id}/inventory/init` }),
    batchInitializeInventory: (payload: BatchInitializeInventoryRequest) =>
      request<BatchInitializeInventoryResult>({
        method: 'POST',
        url: '/admin/train-runs/inventory/init-batch',
        data: payload
      }),
    inventory: (id: number) => request<Params[]>({ url: `/admin/train-runs/${id}/inventory` }),

    orders: (params: Params) => request<PageData<OrderSummary>>({ url: '/admin/orders', params }),
    orderDetail: (id: number) => request<Params>({ url: `/admin/orders/${id}` }),
    payments: (params: Params) => request<PageData<Params>>({ url: '/admin/payments', params }),
    refunds: (params: Params) => request<PageData<Params>>({ url: '/admin/refunds', params }),
    changes: (params: Params) => request<PageData<Params>>({ url: '/admin/changes', params }),

    users: (params: Params) => request<PageData<UserProfile>>({ url: '/admin/users', params }),
    createAdmin: (payload: Params) => request<UserProfile>({ method: 'POST', url: '/admin/users', data: payload }),
    updateUserStatus: (id: number, status: string) => request<void>({ method: 'PATCH', url: `/admin/users/${id}/status`, data: { status } }),
    updateUserRoles: (id: number, roles: string[]) => request<void>({ method: 'PUT', url: `/admin/users/${id}/roles`, data: { roles } }),
    resetUserPassword: (id: number, newPassword: string) => request<void>({ method: 'PUT', url: `/admin/users/${id}/password`, data: { newPassword } }),
    roles: () => request<Params[]>({ url: '/admin/roles' }),
    logs: (params: Params) => request<PageData<Params>>({ url: '/admin/operation-logs', params }),
    logDetail: (id: number) => request<Params>({ url: `/admin/operation-logs/${id}` })
  }
}
