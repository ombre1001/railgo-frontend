export interface ApiResult<T> {
  code: number
  data: T
  message: string
  requestId?: string
  timestamp?: string
}

export interface PageData<T> {
  records?: T[]
  list?: T[]
  total: number
  current?: number
  page?: number
  size?: number
  pageSize?: number
  pages?: number
}

export interface UserProfile {
  id: number
  phone?: string
  nickname: string
  email?: string
  status?: string
  /** 后端当前使用 roles；保留 role 以兼容只返回单角色的部署。 */
  roles?: string[]
  role?: string | string[]
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: UserProfile
}

export interface Station {
  id: number
  stationCode?: string
  name: string
  pinyin?: string
  city?: string
  province?: string
  address?: string
  railwayBureau?: string
  normalizedName?: string
  pinyinInitial?: string
  district?: string
  passengerService?: boolean
  luggageService?: boolean
  parcelService?: boolean
  longitude?: number
  latitude?: number
  status?: string
  hotScore?: number
}

export interface Fare {
  seatTypeCode: string
  seatTypeName: string
  price: number
  availableCount: number
}

export interface TrainRun {
  runId: number
  trainNo: string
  trainType: string
  originStation?: string
  terminalStation?: string
  fromStation: string
  toStation: string
  fromSeq?: number
  toSeq?: number
  departureDateTime: string
  arrivalDateTime: string
  durationMinutes: number
  fares: Fare[]
}

export interface TransferPlan {
  transferStationId: number
  transferStationCode?: string
  firstLeg: TrainRun
  secondLeg: TrainRun
  transferStation: string
  waitMinutes: number
  totalDurationMinutes: number
  minimumTotalPrice: number
}

export interface Passenger {
  id: number
  name: string
  idType: string
  idNoMasked?: string
  idNo?: string
  passengerType: string
  phone?: string
}

export interface Ticket {
  ticketId?: number
  passengerName: string
  trainNo: string
  fromStationName?: string
  toStationName?: string
  departureDateTime?: string
  arrivalDateTime?: string
  seatTypeName: string
  seatTypeCode?: string
  coachNo: string
  seatNo: string
  price: number
  ticketStatus?: string
}

export interface OrderSummary {
  orderId: number
  orderNo: string
  status: string
  totalAmount: number
  expireAt?: string
  remainingSeconds?: number
  createdAt: string
  updatedAt?: string
  firstTravelDate?: string
  trainNos?: string
  userPhone?: string
  userNickname?: string
  fromStationName?: string
  toStationName?: string
  passengerCount?: number
  ticketCount?: number
  tickets?: Ticket[]
}

export interface OrderDetail extends OrderSummary {
  items?: Array<Record<string, any>>
  payments?: Array<Record<string, any>>
  refunds?: Array<Record<string, any>>
  changes?: Array<Record<string, any>>
}

export interface SalesSummary {
  orderCount: number
  paidOrderCount: number
  ticketCount: number
  grossSales: number
  refundAmount: number
  returnFeeAmount?: number
  changePaymentAmount?: number
  changeRefundAmount?: number
  netRevenue: number
}

export interface TrainSyncSummary {
  startDate: string
  endDate: string
  successDays: number
  failedDays: number
  trainCount: number
  stopCount: number
}

export interface TrainSyncLog {
  id: number
  batchId: string
  source: string
  sourceDate: string
  startedAt: string
  finishedAt?: string
  result: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED'
  trainCount: number
  stopCount: number
  errorText?: string
}

export interface AdminTrainRun {
  id: number
  trainId: number
  trainNo: string
  runDate: string
  saleStatus: string
  inventoryInitialized: boolean
  inventoryInitializedAt: string | null
}
