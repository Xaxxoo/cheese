'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getMerchantDashboard,
  getMerchantPayment,
  listMerchantPayments,
  listMerchantSettlements,
  listTopMerchantCustomers,
} from '../lib/merchant-api';

export const merchantQueryKeys = {
  dashboard: ['merchant', 'dashboard'] as const,
  payments: ['merchant', 'payments'] as const,
  payment: (paymentId: string) => ['merchant', 'payments', paymentId] as const,
  settlements: ['merchant', 'settlements'] as const,
  customers: ['merchant', 'customers'] as const,
};

export function useMerchantDashboard() {
  return useQuery({
    queryKey: merchantQueryKeys.dashboard,
    queryFn: getMerchantDashboard,
    staleTime: 20_000,
  });
}

export function useMerchantPayments() {
  return useQuery({
    queryKey: merchantQueryKeys.payments,
    queryFn: () => listMerchantPayments(),
    staleTime: 10_000,
  });
}

export function useMerchantPayment(paymentId: string) {
  return useQuery({
    queryKey: merchantQueryKeys.payment(paymentId),
    queryFn: () => getMerchantPayment(paymentId),
    staleTime: 10_000,
    enabled: !!paymentId,
  });
}

export function useMerchantSettlements() {
  return useQuery({
    queryKey: merchantQueryKeys.settlements,
    queryFn: listMerchantSettlements,
    staleTime: 10_000,
  });
}

export function useMerchantCustomers() {
  return useQuery({
    queryKey: merchantQueryKeys.customers,
    queryFn: listTopMerchantCustomers,
    staleTime: 60_000,
  });
}
