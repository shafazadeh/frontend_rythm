import { create } from 'zustand';
import { ThemeMode } from '../shared/types/domain';

interface AppUIState {
  theme: ThemeMode;
  mobileNavOpen: boolean;
  simulateThursday10AM: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setSimulateThursday10AM: (val: boolean) => void;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('rhythm_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return 'light';
}

export const useAppStore = create<AppUIState>((set) => ({
  theme: getInitialTheme(),
  mobileNavOpen: false,
  simulateThursday10AM: true, // Demo default: Thursday 10:00 planning prompt ready for Happy Path
  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      window.localStorage.setItem('rhythm_theme', theme);
    }
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const next: ThemeMode = state.theme === 'light' ? 'dark' : 'light';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
        window.localStorage.setItem('rhythm_theme', next);
      }
      return { theme: next };
    }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setSimulateThursday10AM: (simulateThursday10AM) => set({ simulateThursday10AM }),
}));
