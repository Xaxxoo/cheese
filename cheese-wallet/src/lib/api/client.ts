// ─────────────────────────────────────────────────────────
// CHEESE PAY — Axios API Client
// Handles: base URL, auth headers, token refresh, errors
// ─────────────────────────────────────────────────────────

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { API_URL, ENDPOINTS } from '@/constants'
import type { ApiError, AuthTokens } from '@/types'

// ── Token storage helpers ─────────────────────────────────
// Stored in memory (not localStorage) for security.
// On refresh the access token is renewed; the refresh token
// is stored in an httpOnly cookie by the server.
let _accessToken: string | null = null

export const tokenStore = {
  get: ()           => _accessToken,
  set: (t: string)  => { _accessToken = t },
  clear: ()         => { _accessToken = null },
}

// ── Create axios instance ─────────────────────────────────
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  withCredentials: true,   // sends the httpOnly refresh-token cookie
  headers: {
    'Content-Type': 'application/json',
    'X-App-Version': '1.0.0',
    'X-Platform': 'pwa',
  },
})

// ── Request interceptor — attach Bearer token ─────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.get()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── Response interceptor — handle 401 + token refresh ─────
let _refreshPromise: Promise<string> | null = null

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // If 401 and we haven't retried yet, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Deduplicate concurrent refresh calls
        if (!_refreshPromise) {
          _refreshPromise = axios
            .post<{ data: AuthTokens }>(
              `${API_URL}${ENDPOINTS.AUTH.REFRESH}`,
              {},
              { withCredentials: true },
            )
            .then((res) => {
              const { accessToken } = res.data.data
              tokenStore.set(accessToken)
              return accessToken
            })
            .finally(() => {
              _refreshPromise = null
            })
        }

        const newToken = await _refreshPromise
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch {
        // Refresh failed — clear token and let the auth store handle redirect
        tokenStore.clear()
        window.dispatchEvent(new CustomEvent('cheese:auth:expired'))
        return Promise.reject(normaliseError(error))
      }
    }

    return Promise.reject(normaliseError(error))
  },
)

// ── Error normaliser ──────────────────────────────────────
function normaliseError(error: AxiosError<ApiError>): Error & { statusCode?: number } {
  const apiMsg = error.response?.data?.message
  const statusCode = error.response?.status
  const msg = Array.isArray(apiMsg) ? apiMsg[0] : (apiMsg ?? error.message ?? 'Something went wrong')
  const normalised = new Error(msg) as Error & { statusCode?: number }
  normalised.statusCode = statusCode
  return normalised
}

export default apiClient
