'use client';

// ─────────────────────────────────────────────────────────
// CHEESE PAY — Merchant Axios Client
// Separate from the user/admin client: different token store,
// different refresh endpoint, different cookie name.
// ─────────────────────────────────────────────────────────

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/constants';

const MERCHANT_REFRESH_PATH = '/merchant/auth/refresh';

// ── In-memory merchant access token ───────────────────────
let _merchantToken: string | null = null;

export const merchantTokenStore = {
  get:   ()            => _merchantToken,
  set:   (t: string)   => { _merchantToken = t },
  clear: ()            => { _merchantToken = null },
};

// ── Axios instance ────────────────────────────────────────
const merchantApiClient: AxiosInstance = axios.create({
  baseURL:         API_URL,
  timeout:         15_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor ───────────────────────────────────
merchantApiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = merchantTokenStore.get();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor — silent token refresh on 401 ───
let _refreshPromise: Promise<string> | null = null;

merchantApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        if (!_refreshPromise) {
          _refreshPromise = axios
            .post<{ data: { accessToken: string } }>(
              `${API_URL}${MERCHANT_REFRESH_PATH}`,
              {},
              { withCredentials: true },
            )
            .then((res) => {
              const { accessToken } = res.data.data;
              merchantTokenStore.set(accessToken);
              return accessToken;
            })
            .finally(() => { _refreshPromise = null; });
        }

        const newToken = await _refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return merchantApiClient(original);
      } catch {
        merchantTokenStore.clear();
        window.dispatchEvent(new CustomEvent('merchant:auth:expired'));
        return Promise.reject(error);
      }
    }

    const apiMsg = (error.response?.data as { message?: string })?.message;
    const msg    = Array.isArray(apiMsg) ? apiMsg[0] : (apiMsg ?? error.message ?? 'Something went wrong');
    return Promise.reject(new Error(msg));
  },
);

export default merchantApiClient;
