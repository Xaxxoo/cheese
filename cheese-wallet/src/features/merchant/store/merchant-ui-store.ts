'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MerchantTheme } from '../types';

interface MerchantUiStore {
  theme: MerchantTheme;
  mobileNavOpen: boolean;
  setTheme: (theme: MerchantTheme) => void;
  toggleTheme: () => void;
  setMobileNavOpen: (value: boolean) => void;
}

export const useMerchantUiStore = create<MerchantUiStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      mobileNavOpen: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({
          theme: get().theme === 'light' ? 'dark' : 'light',
        }),
      setMobileNavOpen: (value) => set({ mobileNavOpen: value }),
    }),
    {
      name: 'cheese-merchant-ui',
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
        theme: state.theme,
      }),
    },
  ),
);
