import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_URL } from '../constants'

const ACCESS_KEY  = 'cheese_access_token'
const REFRESH_KEY = 'cheese_refresh_token'

// ── Token store backed by SecureStore ──────────────────────
export const tokenStore = {
  async getAccess(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_KEY)
  },
  async setAccess(token: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, token)
  },
  async getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY)
  },
  async setRefresh(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_KEY, token)
  },
  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ])
  },
}

// ── Axios instance ─────────────────────────────────────────
const client: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor — attach Bearer token ──────────────
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStore.getAccess()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Refresh deduplication ──────────────────────────────────
let refreshing: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  const refreshToken = await tokenStore.getRefresh()
  if (!refreshToken) throw new Error('No refresh token')

  const res = await axios.post<{ data: { accessToken: string; refreshToken: string } }>(
    `${API_URL}/auth/refresh`,
    { refreshToken },
    { timeout: 10_000 },
  )
  const { accessToken, refreshToken: newRefresh } = res.data.data
  await tokenStore.setAccess(accessToken)
  await tokenStore.setRefresh(newRefresh)
  return accessToken
}

// ── Response interceptor — handle 401 ────────────────────
client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        if (!refreshing) {
          refreshing = doRefresh().finally(() => { refreshing = null })
        }
        const token = await refreshing
        original.headers.Authorization = `Bearer ${token}`
        return client(original)
      } catch {
        await tokenStore.clear()
        // Emit event so the app can navigate to login
        authExpiredListeners.forEach((fn) => fn())
      }
    }
    return Promise.reject(error)
  },
)

// ── Auth-expired listeners ─────────────────────────────────
type Listener = () => void
const authExpiredListeners: Listener[] = []
export function onAuthExpired(fn: Listener) {
  authExpiredListeners.push(fn)
  return () => {
    const i = authExpiredListeners.indexOf(fn)
    if (i !== -1) authExpiredListeners.splice(i, 1)
  }
}

export default client
