import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResult } from '@/types/api'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('railgo_access_token')
  const url = config.url || ''
  const isPublicAuthRequest = /^\/auth\/(login|register|refresh)$/.test(url)
  if (token && !isPublicAuthRequest) config.headers.Authorization = `Bearer ${token}`
  else delete config.headers.Authorization
  config.headers['X-Request-Id'] = crypto.randomUUID()
  return config
})

http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResult<unknown>
    if (typeof body?.code === 'number' && body.code !== 0) {
      ElMessage.error(body.message || '请求失败')
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return response
  },
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('railgo_access_token')
      localStorage.removeItem('railgo_refresh_token')
    }
    ElMessage.error(error.response?.data?.message || error.message || '网络连接失败')
    return Promise.reject(error)
  }
)

function cleanParams(params: unknown) {
  if (!params || typeof params !== 'object') return params
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null))
}

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  config.params = cleanParams(config.params)
  const response = await http.request<ApiResult<T>>(config)
  return response.data.data
}

export async function download(config: AxiosRequestConfig, fallbackName: string) {
  config.params = cleanParams(config.params)
  const response = await http.request<Blob>({ ...config, responseType: 'blob' })
  const disposition = String(response.headers['content-disposition'] || '')
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  const fileName = encoded ? decodeURIComponent(encoded) : plain || fallbackName
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return fileName
}

export default http
