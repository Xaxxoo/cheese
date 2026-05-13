'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MerchantSession } from '../types';

type PendingAuthIntent = 'sign-in' | 'sign-up' | null;

interface MerchantAuthStore {
  session: MerchantSession | null;
  hydrated: boolean;
  pendingEmail: string | null;
  pendingIntent: PendingAuthIntent;
  setHydrated: (value: boolean) => void;
  beginChallenge: (email: string, intent: Exclude<PendingAuthIntent, null>) => void;
  completeChallenge: (session: MerchantSession) => void;
  completeOnboarding: (sessionPatch: Partial<MerchantSession>) => void;
  signOut: () => void;
}

export const useMerchantAuthStore = create<MerchantAuthStore>()(
  persist(
    (set) => ({
      session: null,
      hydrated: false,
      pendingEmail: null,
      pendingIntent: null,
      setHydrated: (value) => set({ hydrated: value }),
      beginChallenge: (email, intent) =>
        set({
          pendingEmail: email.toLowerCase(),
          pendingIntent: intent,
        }),
      completeChallenge: (session) =>
        set({
          session,
          pendingEmail: null,
          pendingIntent: null,
        }),
      completeOnboarding: (sessionPatch) =>
        set((state) => ({
          session: state.session
            ? {
                ...state.session,
                ...sessionPatch,
                merchant: {
                  ...state.session.merchant,
                  ...sessionPatch.merchant,
                },
              }
            : null,
        })),
      signOut: () =>
        set({
          session: null,
          pendingEmail: null,
          pendingIntent: null,
        }),
    }),
    {
      name: 'cheese-merchant-auth',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }

        return localStorage;
      }),
      partialize: (state) => ({
        session: state.session,
        pendingEmail: state.pendingEmail,
        pendingIntent: state.pendingIntent,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
