import client from './client'
import type { ApiResponse, BillVariation, PayBillPayload, PayBillResponse } from '../types'

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

export async function getBillers(category?: string): Promise<Biller[]> {
  const { data } = await client.get<ApiResponse<Biller[]>>('/bills/billers', {
    params: category ? { category } : undefined,
  })
  return data.data
}

export async function getBillVariations(serviceId: string): Promise<BillVariation[]> {
  const { data } = await client.get<ApiResponse<BillVariation[]>>('/bills/variations', {
    params: { serviceId },
  })
  return data.data
}

export async function verifyBillCustomer(payload: {
  serviceId: string
  billersCode: string
  variationCode?: string
}): Promise<{ name: string; address?: string; customerName?: string }> {
  const { data } = await client.post<ApiResponse<{ name: string; address?: string; customerName?: string }>>(
    '/bills/verify', payload,
  )
  return data.data
}

export async function payBill(payload: PayBillPayload): Promise<PayBillResponse> {
  const { data } = await client.post<ApiResponse<PayBillResponse>>(
    '/bills/pay', payload, { timeout: 60_000 },
  )
  return data.data
}
