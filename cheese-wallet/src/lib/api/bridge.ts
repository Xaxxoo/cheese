// ─────────────────────────────────────────────────────────
// CHEESE PAY — Bridge (non-Nigeria off-ramp) API helpers
// ─────────────────────────────────────────────────────────

import apiClient from './client'
import { ENDPOINTS } from '@/constants'
import type { ApiResponse } from '@/types'

// ── Types ────────────────────────────────────────────────

export interface BridgeCountry {
  code: string
  name: string
  currency: string
  paymentRail: string
  minTransferUsdc: number
  maxTransferUsdc: number
  feePercent: number
}

export interface BridgeTransferPayload {
  countryCode: string
  amountUsdc: string
  recipientName: string
  accountIdentifier: string
  bankCode?: string
  bankName?: string
  pinHash: string
  deviceSignature: string
  deviceId: string
  timestamp?: string
  nonce?: string
}

export interface BridgeTransferResponse {
  reference: string
  status: string
  amountUsdc: string
  feeUsdc: string
  country: string
  currency: string
  message: string
}

// ── API calls ────────────────────────────────────────────

export async function getBridgeCountries(): Promise<BridgeCountry[]> {
  const { data } = await apiClient.get<ApiResponse<BridgeCountry[]>>(
    ENDPOINTS.BRIDGE.COUNTRIES,
  )
  return data.data
}

export async function bridgeTransfer(
  payload: BridgeTransferPayload,
): Promise<BridgeTransferResponse> {
  const { data } = await apiClient.post<ApiResponse<BridgeTransferResponse>>(
    ENDPOINTS.BRIDGE.TRANSFER,
    payload,
    { timeout: 60_000 },
  )
  return data.data
}

export async function syncBridgeTransferStatus(
  reference: string,
): Promise<{ reference: string; status: string; synced: boolean }> {
  const { data } = await apiClient.get<
    ApiResponse<{ reference: string; status: string; synced: boolean }>
  >(ENDPOINTS.BRIDGE.TRANSFER_STATUS(reference))
  return data.data
}
