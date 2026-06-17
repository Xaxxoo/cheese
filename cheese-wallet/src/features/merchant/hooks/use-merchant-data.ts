'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMerchantDashboard,
  getMerchantPayment,
  listMerchantPayments,
  listMerchantSettlements,
  listTopMerchantCustomers,
  addMerchantPayoutAccount,
  updateMerchantPayoutAccount,
  removeMerchantPayoutAccount,
  setDefaultMerchantPayoutAccount,
  listMerchantApiKeys,
  createMerchantApiKey,
  revokeMerchantApiKey,
  listMerchantWebhooks,
  createMerchantWebhook,
  updateMerchantWebhook,
  deleteMerchantWebhook,
  getMerchantWebhookDeliveries,
} from '../lib/merchant-api';
import { MOCK_DASHBOARD, MOCK_PAYMENTS, MOCK_SETTLEMENTS } from '../lib/mock-data';

const DEV_BYPASS =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_MERCHANT_DEV_BYPASS === 'true';

export const merchantQueryKeys = {
  dashboard:         ['merchant', 'dashboard'] as const,
  payments:          ['merchant', 'payments'] as const,
  payment:           (paymentId: string) => ['merchant', 'payments', paymentId] as const,
  settlements:       ['merchant', 'settlements'] as const,
  customers:         ['merchant', 'customers'] as const,
  apiKeys:           ['merchant', 'api-keys'] as const,
  webhooks:          ['merchant', 'webhooks'] as const,
  webhookDeliveries: (webhookId: string) => ['merchant', 'webhooks', webhookId, 'deliveries'] as const,
};

export function useMerchantDashboard() {
  return useQuery({
    queryKey: merchantQueryKeys.dashboard,
    queryFn:  DEV_BYPASS ? () => Promise.resolve(MOCK_DASHBOARD) : getMerchantDashboard,
    staleTime: 20_000,
  });
}

export function useMerchantPayments() {
  return useQuery({
    queryKey: merchantQueryKeys.payments,
    queryFn:  DEV_BYPASS ? () => Promise.resolve(MOCK_PAYMENTS) : () => listMerchantPayments(),
    staleTime: 10_000,
  });
}

export function useMerchantPayment(paymentId: string) {
  return useQuery({
    queryKey: merchantQueryKeys.payment(paymentId),
    queryFn:  DEV_BYPASS
      ? () => Promise.resolve({
          payment:     MOCK_PAYMENTS.find((p) => p.id === paymentId) ?? MOCK_PAYMENTS[0],
          timeline: [
            { id: 'tl_1', label: 'Payment created',    description: 'Checkout session initialised', at: MOCK_PAYMENTS[0].createdAt,                    status: 'done'    as const },
            { id: 'tl_2', label: 'Awaiting on-chain',  description: 'Waiting for network confirmation', at: new Date(Date.now() - 50_000).toISOString(), status: 'done'    as const },
            { id: 'tl_3', label: 'Confirmed',          description: 'Transaction confirmed on-chain',    at: new Date(Date.now() - 30_000).toISOString(), status: 'done'    as const },
            { id: 'tl_4', label: 'Settlement complete', description: 'Funds pushed to Zenith Bank',     at: new Date(Date.now() - 10_000).toISOString(), status: 'current' as const },
            { id: 'tl_5', label: 'Bank credit',        description: 'Expected within 15 seconds',       at: new Date().toISOString(),                    status: 'upcoming' as const },
          ],
          feeSummary: {
            processingFee: '0.35% (₦1,680)',
            settlementFee: '0.20% (₦960)',
            fxRate:        '1 USDC = ₦1,598.40',
            payoutEta:     '~11 seconds',
          },
        })
      : () => getMerchantPayment(paymentId),
    staleTime: 10_000,
    enabled: !!paymentId,
  });
}

export function useMerchantSettlements() {
  return useQuery({
    queryKey: merchantQueryKeys.settlements,
    queryFn:  DEV_BYPASS ? () => Promise.resolve(MOCK_SETTLEMENTS) : listMerchantSettlements,
    staleTime: 10_000,
  });
}

export function useAddPayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addMerchantPayoutAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantQueryKeys.settlements }),
  });
}

export function useUpdatePayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      updateMerchantPayoutAccount(id, { label }),
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantQueryKeys.settlements }),
  });
}

export function useRemovePayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeMerchantPayoutAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantQueryKeys.settlements }),
  });
}

export function useSetDefaultPayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setDefaultMerchantPayoutAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantQueryKeys.settlements }),
  });
}

export function useMerchantCustomers() {
  return useQuery({
    queryKey: merchantQueryKeys.customers,
    queryFn:  DEV_BYPASS
      ? () => Promise.resolve([])
      : listTopMerchantCustomers,
    staleTime: 60_000,
  });
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export function useMerchantApiKeys() {
  return useQuery({
    queryKey: merchantQueryKeys.apiKeys,
    queryFn: DEV_BYPASS
      ? () => Promise.resolve({ active: [], revoked: [] })
      : listMerchantApiKeys,
    staleTime: 10_000,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; scopes: string[] }) => createMerchantApiKey(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantQueryKeys.apiKeys }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeMerchantApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantQueryKeys.apiKeys }),
  });
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export function useMerchantWebhooks() {
  return useQuery({
    queryKey: merchantQueryKeys.webhooks,
    queryFn: DEV_BYPASS
      ? () => Promise.resolve({ webhooks: [] })
      : listMerchantWebhooks,
    staleTime: 10_000,
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { url: string; description?: string; events: string[] }) =>
      createMerchantWebhook(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantQueryKeys.webhooks }),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string; url?: string; description?: string; events?: string[]; enabled?: boolean }) =>
      updateMerchantWebhook(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantQueryKeys.webhooks }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMerchantWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantQueryKeys.webhooks }),
  });
}

export function useMerchantWebhookDeliveries(webhookId: string) {
  return useQuery({
    queryKey: merchantQueryKeys.webhookDeliveries(webhookId),
    queryFn: DEV_BYPASS
      ? () => Promise.resolve({ deliveries: [] })
      : () => getMerchantWebhookDeliveries(webhookId),
    staleTime: 10_000,
    enabled: !!webhookId,
  });
}
