// cheese-wallet/src/lib/api/bills.ts
import apiClient from './client'
import { ENDPOINTS } from '@/constants'
import type { ApiResponse } from '@/types'

export interface Biller {
  id: number
  biller_code: string
  name: string
  country: string
  is_airtime: boolean
  biller_name: string
  item_code: string
  short_name: string
  fee: number
  amount: number
  label_name: string
}

export interface BillVariation {
  variation_code: string
  name: string
  variation_amount: string
  fixedPrice: string
}

export interface BillVariationsResponse {
  serviceId: string
  variations: BillVariation[]
}

export interface VerifyBillCustomerPayload {
  serviceId: string
  billersCode: string
  variationCode?: string
}

export interface VerifyBillCustomerResponse {
  verified: boolean
  customerName: string | null
  details: Record<string, unknown>
}

export interface PayBillPayload {
  serviceId: string
  billersCode: string
  variationCode?: string
  amount?: string
  pinHash: string
  deviceSignature: string
  deviceId: string
  timestamp?: string
  nonce?: string
}

export interface PayBillResponse {
  reference: string
  status: string
  message: string
  serviceId: string
  billersCode: string
  amountNgn: string
  amountUsdc: string
  rateApplied: string
  fee: string
  providerReference: string
  purchasedCode: string | null
  stellarTxHash: string
}

export async function getBillers(category?: string): Promise<Biller[]> {
  const { data } = await apiClient.get<ApiResponse<Biller[]>>(
    ENDPOINTS.BILLS.BILLERS,
    { params: category ? { category } : undefined },
  )
  return data.data
}

export async function getBillVariations(serviceId: string): Promise<BillVariationsResponse> {
  const { data } = await apiClient.get<ApiResponse<BillVariationsResponse>>(
    ENDPOINTS.BILLS.VARIATIONS,
    { params: { serviceId } },
  )
  return data.data
}

export async function verifyBillCustomer(
  payload: VerifyBillCustomerPayload,
): Promise<VerifyBillCustomerResponse> {
  const { data } = await apiClient.post<ApiResponse<VerifyBillCustomerResponse>>(
    ENDPOINTS.BILLS.VERIFY,
    payload,
  )
  return data.data
}

export async function payBill(payload: PayBillPayload): Promise<PayBillResponse> {
  const { data } = await apiClient.post<ApiResponse<PayBillResponse>>(
    ENDPOINTS.BILLS.PAY,
    payload,
    { timeout: 60_000 },
  )
  return data.data
}
