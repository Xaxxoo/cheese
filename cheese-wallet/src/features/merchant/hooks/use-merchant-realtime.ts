'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { merchantQueryKeys } from './use-merchant-data';
import { useMerchantAuthStore } from '../store/merchant-auth-store';
import { notify } from '@/lib/toast';

export function useMerchantRealtime() {
  const queryClient = useQueryClient();
  const session = useMerchantAuthStore((state) => state.session);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_MERCHANT_WS_URL;
    if (!wsUrl || !session?.accessToken) return;

    const socket = io(wsUrl, {
      transports: ['websocket'],
      auth: {
        token: session.accessToken,
      },
    });

    function invalidateCoreData() {
      void queryClient.invalidateQueries({ queryKey: merchantQueryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: merchantQueryKeys.payments });
      void queryClient.invalidateQueries({ queryKey: merchantQueryKeys.settlements });
    }

    socket.on('payment.confirmed', (payload: { reference: string }) => {
      notify.success(`Payment ${payload.reference} confirmed`);
      invalidateCoreData();
    });

    socket.on('payment.failed', (payload: { reference: string }) => {
      notify.error(`Payment ${payload.reference} failed`);
      invalidateCoreData();
    });

    socket.on('settlement.settled', (payload: { paymentReference: string }) => {
      notify.success(`Settlement completed for ${payload.paymentReference}`);
      invalidateCoreData();
    });

    socket.on('risk.alert.created', () => {
      notify.warning('Suspicious activity detected for review.');
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient, session?.accessToken]);
}
