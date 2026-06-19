// ─────────────────────────────────────────────────────────
// CHEESE PAY — Axios API Client
// Handles: base URL, auth headers, token refresh, errors
// ─────────────────────────────────────────────────────────

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_URL, ENDPOINTS } from '@/constants';
import type { ApiError, AuthTokens } from '@/types';

// ── Token storage helpers ─────────────────────────────────
// Stored in memory (not localStorage) for security.
// On refresh the access token is renewed; the refresh token
// is stored in an httpOnly cookie by the server.
let _accessToken: string | null = null;

export const tokenStore = {
  get: () => _accessToken,
  set: (t: string) => {
    _accessToken = t;
  },
  clear: () => {
    _accessToken = null;
  },
};

// ── Cross-tab refresh coordination ────────────────────────
// Prevents multiple tabs from racing to call /auth/refresh
// simultaneously (which would rotate and revoke each other's tokens).
const REFRESH_LOCK_KEY = 'cheese-refresh-lock';
const LOCK_TTL_MS = 10_000; // lock expires after 10s if holder crashes

const channel =
  typeof window !== 'undefined' ? new BroadcastChannel('cheese-auth') : null;

// Receive token updates broadcast by the tab that won the refresh race
channel?.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'token') {
    tokenStore.set(event.data.accessToken as string);
  }
  if (event.data?.type === 'expired') {
    tokenStore.clear();
    window.dispatchEvent(new CustomEvent('cheese:auth:expired'));
  }
});

function isRefreshLocked(): boolean {
  if (typeof window === 'undefined') return false;
  const lock = localStorage.getItem(REFRESH_LOCK_KEY);
  if (!lock) return false;
  if (Date.now() - parseInt(lock, 10) > LOCK_TTL_MS) {
    localStorage.removeItem(REFRESH_LOCK_KEY);
    return false;
  }
  return true;
}

// Wait for the winning tab to broadcast the new token (up to 12s)
function waitForTokenBroadcast(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      channel?.removeEventListener('message', handler);
      reject(new Error('Token broadcast timeout'));
    }, 12_000);

    function handler(event: MessageEvent) {
      if (event.data?.type === 'token') {
        clearTimeout(timer);
        channel?.removeEventListener('message', handler);
        resolve(event.data.accessToken as string);
      }
      if (event.data?.type === 'expired') {
        clearTimeout(timer);
        channel?.removeEventListener('message', handler);
        reject(new Error('Auth expired'));
      }
    }

    channel?.addEventListener('message', handler);
  });
}

// ── Create axios instance ─────────────────────────────────
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  withCredentials: true, // sends the httpOnly refresh-token cookie
  headers: {
    'Content-Type': 'application/json',
    'X-App-Version': '1.0.0',
    'X-Platform': 'pwa',
  },
});

// ── Request interceptor — attach Bearer token ─────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor — handle 401 + token refresh ─────
let _refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 and we haven't retried yet, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Deduplicate within this tab, and coordinate across tabs
        if (!_refreshPromise) {
          if (isRefreshLocked()) {
            // Another tab owns the refresh — wait for it to broadcast the token
            _refreshPromise = waitForTokenBroadcast().finally(() => {
              _refreshPromise = null;
            });
          } else {
            // This tab wins — acquire lock, refresh, then broadcast result
            localStorage.setItem(REFRESH_LOCK_KEY, String(Date.now()));
            _refreshPromise = axios
              .post<{ data: AuthTokens }>(
                `${API_URL}${ENDPOINTS.AUTH.REFRESH}`,
                {},
                { withCredentials: true },
              )
              .then((res) => {
                const { accessToken } = res.data.data;
                tokenStore.set(accessToken);
                channel?.postMessage({ type: 'token', accessToken });
                return accessToken;
              })
              .catch((err: unknown) => {
                channel?.postMessage({ type: 'expired' });
                throw err;
              })
              .finally(() => {
                localStorage.removeItem(REFRESH_LOCK_KEY);
                _refreshPromise = null;
              });
          }
        }

        const newToken = await _refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — clear token and let the auth store handle redirect
        tokenStore.clear();
        window.dispatchEvent(new CustomEvent('cheese:auth:expired'));
        return Promise.reject(normaliseError(error));
      }
    }

    return Promise.reject(normaliseError(error));
  },
);

// ── Error normaliser ──────────────────────────────────────
function normaliseError(
  error: AxiosError<ApiError>,
): Error & { statusCode?: number } {
  const apiError = error.response?.data;
  const apiMsg = apiError?.message;
  const statusCode = error.response?.status;
  const msg = Array.isArray(apiMsg)
    ? apiMsg[0]
    : (apiMsg ?? error.message ?? 'Something went wrong');
  const normalised = new Error(msg) as Error & {
    statusCode?: number;
    errorCode?: string;
    email?: string;
    details?: ApiError;
  };
  normalised.statusCode = statusCode;
  normalised.errorCode =
    typeof apiError?.code === 'string' ? apiError.code : apiError?.error;
  normalised.email =
    typeof apiError?.email === 'string' ? apiError.email : undefined;
  normalised.details = apiError;
  return normalised;
}

export default apiClient;
