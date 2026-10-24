import React from 'react';
import { Moon, Sun, Terminal, Sparkles } from 'lucide-react';
import { useThemeStore } from '../stores/useThemeStore';
import type { AppTheme } from '../stores/useThemeStore';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  const themes: { id: AppTheme; label: string; icon: React.ReactNode }[] = [
    { id: 'dark', label: 'Dark Slate', icon: <Moon className="w-3.5 h-3.5" /> },
    { id: 'light', label: 'Light Clean', icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'obsidian', label: 'Obsidian Void', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'glass', label: 'Liquid Glass', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex items-center bg-black/25 p-1 rounded-xl border border-[var(--border-card)] shadow-inner">
      {themes.map((t) => {
        const isActive = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            title={`Switch to ${t.label}`}
            aria-label={`Switch to ${t.label} theme`}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
              isActive
                ? 'bg-[var(--accent-primary)] text-white shadow-md font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};
