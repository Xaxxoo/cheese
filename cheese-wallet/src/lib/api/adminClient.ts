// ─────────────────────────────────────────────────────────
// CHEESE PAY — Admin Axios Client
// Separate from the user client: different token store,
// different refresh endpoint, different cookie name.
// ─────────────────────────────────────────────────────────

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { API_URL, ENDPOINTS } from '@/constants'

// ── In-memory admin access token ─────────────────────────
let _adminToken: string | null = null

export const adminTokenStore = {
  get:   ()            => _adminToken,
  set:   (t: string)   => { _adminToken = t },
  clear: ()            => { _adminToken = null },
}

// ── Axios instance ────────────────────────────────────────
const adminApiClient: AxiosInstance = axios.create({
  baseURL:         API_URL,
  timeout:         15_000,
  withCredentials: true,   // sends the admin_refresh_token httpOnly cookie
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Request interceptor ───────────────────────────────────
adminApiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = adminTokenStore.get()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error),
)

// ── Response interceptor — silent token refresh on 401 ───
let _refreshPromise: Promise<string> | null = null

adminApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      try {
        if (!_refreshPromise) {
          _refreshPromise = axios
            .post<{ data: { accessToken: string } }>(
              `${API_URL}${ENDPOINTS.ADMIN_AUTH.REFRESH}`,
              {},
              { withCredentials: true },
            )
            .then((res) => {
              const { accessToken } = res.data.data
              adminTokenStore.set(accessToken)
              return accessToken
            })
            .finally(() => { _refreshPromise = null })
        }

        const newToken = await _refreshPromise
        original.headers.Authorization = `Bearer ${newToken}`
        return adminApiClient(original)
      } catch {
        adminTokenStore.clear()
        window.dispatchEvent(new CustomEvent('admin:auth:expired'))
        return Promise.reject(error)
      }
    }

    const apiMsg = (error.response?.data as { message?: string })?.message
    const msg    = Array.isArray(apiMsg) ? apiMsg[0] : (apiMsg ?? error.message ?? 'Something went wrong')
    return Promise.reject(new Error(msg))
  },
)

export default adminApiClient
