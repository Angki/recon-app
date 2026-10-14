import { create } from 'zustand';

export type AppTheme = 'dark' | 'light' | 'obsidian' | 'glass';

interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const getInitialTheme = (): AppTheme => {
  try {
    const saved = localStorage.getItem('recon_app_theme') as AppTheme;
    if (['dark', 'light', 'obsidian', 'glass'].includes(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'dark';
};

const initialTheme = getInitialTheme();

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    try {
      localStorage.setItem('recon_app_theme', theme);
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },
}));

// Apply on startup
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
}
