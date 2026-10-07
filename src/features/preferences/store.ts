import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storageKeys } from '../../services/storage/local-storage';

export type ThemeChoice = 'system' | 'light' | 'dark';
export const TEXT_SCALES = { normal: 1, large: 1.15 } as const;
export type TextScale = keyof typeof TEXT_SCALES;

type Preferences = {
  theme: ThemeChoice;
  textScale: TextScale;
  setTheme: (theme: ThemeChoice) => void;
  setTextScale: (textScale: TextScale) => void;
};

// Private windows and blocked storage throw on access; preferences then just don't persist.
const safeStorage = {
  getItem: (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* not persisted */
    }
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
  },
};

export const usePreferencesStore = create<Preferences>()(
  persist(
    (set) => ({
      theme: 'system',
      textScale: 'normal',
      setTheme: (theme) => set({ theme }),
      setTextScale: (textScale) => set({ textScale }),
    }),
    {
      name: storageKeys.preferences,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ theme, textScale }) => ({ theme, textScale }),
    },
  ),
);
