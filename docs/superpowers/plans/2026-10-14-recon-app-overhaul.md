# SecOps Recon App Overhaul & Engine Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul SecOps Recon into a high-productivity Cyber Command Center featuring 4 dynamic themes (Dark Slate, Light Clean, Obsidian Void, Liquid Glass), an automated hybrid tool updater for Nuclei, Wapiti, and ProjectDiscovery suite, install open-source development skills, and package the final production binaries (`.exe` NSIS & Portable).

**Architecture:** Electron multi-process architecture with strict IPC contextIsolation. Renderer uses React 19 + Tailwind CSS with a CSS variable theme engine attached to `<html>[data-theme]`. Main process hosts a unified `ToolManager` service handling version matrix checks, native CLI updates, and direct GitHub Release fallback extraction into `%APPDATA%/ReconApp/bin`.

**Tech Stack:** Electron 42, React 19, TypeScript, TailwindCSS v4, Zustand 5, xterm.js 5, Axios, Extract-Zip, Electron-Builder 26.

---

### Task 1: Install Open-Source Development & Design Skills

**Files:**
- Create: `.agents/skills/electron-pro/SKILL.md`
- Create: `.agents/skills/cyber-ui-theme/SKILL.md`

- [ ] **Step 1: Create `electron-pro` skill**
Write `.agents/skills/electron-pro/SKILL.md` specifying best practices for Electron architecture, secure IPC context bridges, child_process isolation, and memory-safe terminal handling.

```markdown
---
name: electron-pro
description: Production-grade Electron desktop application engineering patterns, security practices, IPC safety, and packaging.
---

# Electron Pro Engineering Patterns

## 1. Security Architecture
- `nodeIntegration: false` and `contextIsolation: true` in all WebPreferences.
- Whitelist only specific IPC channels via `contextBridge.exposeInMainWorld('api', {...})`.
- Never use `child_process.exec` with raw concatenated strings; always use `child_process.spawn` with strict string argument arrays.

## 2. Process & Stream Performance
- Batch frequent IPC events (e.g. stdout streams from fast CLI tools) with micro-throttles (50-100ms) to prevent renderer UI freezing.
- Always clean up child process listeners on scan cancellation or window close.

## 3. Packaging & Assets
- Store downloaded CLI dependencies in `%APPDATA%/ReconApp/bin` (or platform equivalent).
- Use `extraResources` in `package.json` for auxiliary runner scripts.
```

- [ ] **Step 2: Create `cyber-ui-theme` skill**
Write `.agents/skills/cyber-ui-theme/SKILL.md` defining design tokens, glassmorphism principles, and multi-theme color palettes.

```markdown
---
name: cyber-ui-theme
description: Cyber-security command center UI design system, glassmorphism tokens, and accessibility across Dark, Light, Obsidian, and Glass themes.
---

# Cyber UI Theme System

## 1. Design Philosophy
- **Aesthetic**: Futuristic cyber command console with high scanability and ergonomic telemetry.
- **Glassmorphism**: `backdrop-filter: blur(16px)`, `background: rgba(var(--bg-glass-rgb), 0.75)`, subtle border gradient overlays.
- **Obsidian**: Deep pitch black surfaces (`#07070a`), carbon gray cards (`#12131d`), neon cyan (`#00f0ff`) and electric violet (`#a855f7`) accents.

## 2. Component Guidelines
- Status badges: Pulsing glow indicators for active scans (`animate-pulse`).
- Tables: Monospace styling for IPs, URLs, hashes, and CVE identifiers with contrast-checked severity badges.
```

- [ ] **Step 3: Verify skills are discoverable**
Check that `.agents/skills/electron-pro/SKILL.md` and `.agents/skills/cyber-ui-theme/SKILL.md` exist and are well-formed.

- [ ] **Step 4: Commit skills**
```bash
git add .agents/skills/
git commit -m "feat(skills): add electron-pro and cyber-ui-theme open-source skills"
```

---

### Task 2: Build CSS Multi-Theme Engine & Zustand Store

**Files:**
- Create: `src/stores/useThemeStore.ts`
- Modify: `src/index.css`
- Modify: `src/App.css`

- [ ] **Step 1: Create `src/stores/useThemeStore.ts`**
Create the Zustand store supporting `'dark' | 'light' | 'obsidian' | 'glass'` with persistence and DOM synchronization:

```typescript
import { create } from 'zustand';

export type AppTheme = 'dark' | 'light' | 'obsidian' | 'glass';

interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const getInitialTheme = (): AppTheme => {
  const saved = localStorage.getItem('recon_app_theme') as AppTheme;
  if (['dark', 'light', 'obsidian', 'glass'].includes(saved)) {
    return saved;
  }
  return 'dark';
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('recon_app_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));

// Apply on initial script evaluation
document.documentElement.setAttribute('data-theme', getInitialTheme());
```

- [ ] **Step 2: Update `src/index.css` with CSS Custom Properties**
Configure full theme variables and utility classes in `src/index.css`:

```css
@import "tailwindcss";

:root, [data-theme="dark"] {
  --bg-app: #0f172a;
  --bg-surface: #1e293b;
  --bg-card: rgba(30, 41, 59, 0.7);
  --bg-card-hover: rgba(51, 65, 85, 0.8);
  --border-card: rgba(51, 65, 85, 0.6);
  --border-glow: rgba(59, 130, 246, 0.3);
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent-primary: #3b82f6;
  --accent-hover: #2563eb;
  --accent-emerald: #10b981;
  --term-bg: #090d16;
  --term-fg: #e2e8f0;
}

[data-theme="light"] {
  --bg-app: #f1f5f9;
  --bg-surface: #ffffff;
  --bg-card: rgba(255, 255, 255, 0.9);
  --bg-card-hover: rgba(248, 250, 252, 1);
  --border-card: #cbd5e1;
  --border-glow: rgba(37, 99, 235, 0.2);
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --text-muted: #64748b;
  --accent-primary: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-emerald: #059669;
  --term-bg: #1e293b;
  --term-fg: #f8fafc;
}

[data-theme="obsidian"] {
  --bg-app: #050608;
  --bg-surface: #0e1017;
  --bg-card: rgba(14, 16, 23, 0.85);
  --bg-card-hover: rgba(22, 25, 37, 0.9);
  --border-card: rgba(0, 240, 255, 0.15);
  --border-glow: rgba(0, 240, 255, 0.4);
  --text-primary: #f8fafc;
  --text-secondary: #a0aec0;
  --text-muted: #4a5568;
  --accent-primary: #00f0ff;
  --accent-hover: #00c8d7;
  --accent-emerald: #00ffaa;
  --term-bg: #030406;
  --term-fg: #00f0ff;
}

[data-theme="glass"] {
  --bg-app: #090d16;
  --bg-surface: rgba(15, 23, 42, 0.65);
  --bg-card: rgba(30, 41, 59, 0.45);
  --bg-card-hover: rgba(51, 65, 85, 0.6);
  --border-card: rgba(255, 255, 255, 0.12);
  --border-glow: rgba(56, 189, 248, 0.4);
  --text-primary: #ffffff;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;
  --accent-primary: #38bdf8;
  --accent-hover: #0284c7;
  --accent-emerald: #34d399;
  --term-bg: rgba(6, 10, 19, 0.85);
  --term-fg: #f1f5f9;
}

body {
  background-color: var(--bg-app);
  color: var(--text-primary);
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  transition: background-color 0.25s ease, color 0.25s ease;
}

.theme-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-card);
  backdrop-filter: blur(16px);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.theme-card:hover {
  border-color: var(--border-glow);
}
```

- [ ] **Step 3: Update `src/App.css` scrollbars and utility styling**
Ensure custom scrollbar matches `--bg-app` and `--border-card`.

- [ ] **Step 4: Run typecheck to verify `useThemeStore.ts`**
Run: `npx tsc -b`
Expected: 0 errors

- [ ] **Step 5: Commit theme engine**
```bash
git add src/stores/useThemeStore.ts src/index.css src/App.css
git commit -m "feat(theme): add dynamic multi-theme engine supporting dark, light, obsidian, and glass"
```

---

### Task 3: Cyber Command Center Shell & Theme Switcher Component

**Files:**
- Create: `src/components/ThemeSwitcher.tsx`
- Create: `src/components/CommandHeader.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/ThemeSwitcher.tsx`**
Build a theme selector with icons (Moon, Sun, Terminal/Shield, Sparkles/Glass):

```tsx
import React from 'react';
import { Moon, Sun, Terminal, Sparkles } from 'lucide-react';
import { useThemeStore, AppTheme } from '../stores/useThemeStore';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  const themes: { id: AppTheme; label: string; icon: React.ReactNode }[] = [
    { id: 'dark', label: 'Dark Slate', icon: <Moon className="w-3.5 h-3.5" /> },
    { id: 'light', label: 'Light Clean', icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'obsidian', label: 'Obsidian Void', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'glass', label: 'Liquid Glass', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex items-center bg-black/20 p-1 rounded-xl border border-[var(--border-card)]">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={`Switch to ${t.label}`}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            theme === t.id
              ? 'bg-[var(--accent-primary)] text-white shadow-sm font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
          }`}
        >
          {t.icon}
          <span className="hidden md:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
};
```

- [ ] **Step 2: Create `src/components/CommandHeader.tsx`**
Build top telemetry header with live status, scan indicator, and theme switcher:

```tsx
import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useScanStore } from '../stores/useScanStore';

export const CommandHeader: React.FC<{ onOpenToolsHub: () => void }> = ({ onOpenToolsHub }) => {
  const { status, scanId } = useScanStore();

  const isScanning = status === 'RUNNING';

  return (
    <header className="h-14 border-b border-[var(--border-card)] bg-[var(--bg-surface)] flex items-center justify-between px-6 z-10 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isScanning ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)]">
            {isScanning ? `SCANNING: ${scanId?.slice(0, 8)}` : 'SYSTEM READY'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenToolsHub}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-[var(--border-glow)] text-[var(--text-primary)] transition-all cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Engines & Tools</span>
        </button>
        <ThemeSwitcher />
      </div>
    </header>
  );
};
```

- [ ] **Step 3: Refactor `src/App.tsx` layout**
Integrate `CommandHeader`, collapsible command sidebar, responsive styling using CSS custom properties, and modal triggering.

- [ ] **Step 4: Run typecheck**
Run: `npx tsc -b`
Expected: 0 errors

- [ ] **Step 5: Commit Command Center Shell**
```bash
git add src/components/ThemeSwitcher.tsx src/components/CommandHeader.tsx src/App.tsx
git commit -m "feat(ui): add CommandHeader with live telemetry and ThemeSwitcher"
```

---

### Task 4: Enhance Terminal Pane with Theme-Adaptive Colors

**Files:**
- Modify: `src/components/TerminalPane.tsx`

- [ ] **Step 1: Implement dynamic Xterm theme builder**
In `src/components/TerminalPane.tsx`, read active theme from `useThemeStore` and apply custom palettes:
- `obsidian`: Background `#030406`, text cyan `#00f0ff`, cursor neon cyan.
- `light`: Background `#1e293b`, text `#f8fafc`, cursor `#38bdf8`.
- `glass`: Background `rgba(6, 10, 19, 0.9)`, text `#e2e8f0`, cursor `#38bdf8`.
- `dark`: Background `#090d16`, text `#e2e8f0`, cursor `#10b981`.

- [ ] **Step 2: Add theme listener to update xterm instance on theme change**
Call `termRef.current.options.theme = getXtermTheme(currentTheme)` whenever `theme` changes.

- [ ] **Step 3: Verify terminal compilation**
Run: `npx tsc -b`
Expected: 0 errors

- [ ] **Step 4: Commit TerminalPane enhancements**
```bash
git add src/components/TerminalPane.tsx
git commit -m "feat(terminal): make xterm dynamically adaptive to current app theme"
```

---

### Task 5: Hybrid Smart Tool Engine & Updater Service

**Files:**
- Create: `electron/services/toolManager.ts`
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/global.d.ts`

- [ ] **Step 1: Create `electron/services/toolManager.ts`**
Implement the unified `ToolManager` service:
- Tracks: `nuclei`, `subfinder`, `httpx`, `naabu`, `katana`, `dnsx`, `alterx`, `tlsx`, `ffuf`, `wapiti`, `nmap`, `zap`.
- Provides `getHealthMatrix()`: Resolves local installed version via execution (e.g. `nuclei -version`) and queries GitHub Releases API for latest version with a 1-hour cache.
- Provides `updateTool(toolName, sender)`:
  1. For ProjectDiscovery & FFUF: Tries `-update`. If exit code != 0, triggers automatic fallback: downloads latest release zip from GitHub, safely extracts to `%APPDATA%/ReconApp/bin/`, replaces binary cleanly.
  2. For Nuclei Templates: Executes `nuclei -update-templates`.
  3. For Wapiti: Executes `pip install --upgrade wapiti3`.
- Provides `updateAll(sender)`: Iterates through all tools with streaming progress.

- [ ] **Step 2: Register IPC handlers in `electron/ipc.ts`**
Add handlers:
- `tools:get-health` -> `toolManager.getHealthMatrix()`
- `tools:update-single` -> `toolManager.updateTool(name, sender)`
- `tools:update-all` -> `toolManager.updateAll(sender)`

- [ ] **Step 3: Expose IPC methods in `electron/preload.ts` and `src/types/global.d.ts`**
Add `getToolsHealth()`, `updateTool(name)`, `updateAllTools()`, and event listeners `onToolUpdateProgress()`.

- [ ] **Step 4: Run typecheck on both electron and src**
Run: `npx tsc -b`
Expected: 0 errors

- [ ] **Step 5: Commit ToolManager service**
```bash
git add electron/services/toolManager.ts electron/ipc.ts electron/preload.ts src/types/global.d.ts
git commit -m "feat(engine): add resilient ToolManager with version health matrix and direct GitHub download fallback"
```

---

### Task 6: Tools & Engine Health Hub Modal

**Files:**
- Create: `src/components/ToolsHubModal.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Create `src/components/ToolsHubModal.tsx`**
Build a modern modal featuring:
- Matrix table with columns: Tool Name, Type (Recon / DAST / Fuzz), Current Version, Latest Version, Status Badge (Up to Date / Update Available / Missing), Actions (Individual Update button with spinner).
- Master "Update All Engines & Templates" button with live streaming output console and progress indicator.
- Glassmorphism backdrop with close button (`Esc` or `X`).

- [ ] **Step 2: Wire up state and IPC in `ToolsHubModal.tsx`**
Connect `window.api.getToolsHealth()`, `window.api.updateAllTools()`, and listen for real-time progress events.

- [ ] **Step 3: Verify modal layout in all 4 themes**
Ensure borders, backgrounds, and badges use `--border-card`, `--bg-surface`, and `--text-primary`.

- [ ] **Step 4: Run typecheck**
Run: `npx tsc -b`
Expected: 0 errors

- [ ] **Step 5: Commit ToolsHubModal**
```bash
git add src/components/ToolsHubModal.tsx src/App.tsx src/pages/Dashboard.tsx
git commit -m "feat(ui): add ToolsHubModal with live version matrix and update all orchestration"
```

---

### Task 7: Dashboard Bento Grid & Findings Table Overhaul

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/ScannerControls.tsx`
- Modify: `src/components/ToolSelection.tsx`
- Modify: `src/components/VulnerabilityTable.tsx`
- Modify: `src/components/FindingsSummary.tsx`

- [ ] **Step 1: Overhaul `ScannerControls.tsx`**
Modernize target URL input bar with instant validation, protocol switcher (`https://` / `http://`), Quick Preset buttons (Full Recon, Fast Web Scan, WP Audit), and high-contrast Launch/Stop buttons.

- [ ] **Step 2: Overhaul `ToolSelection.tsx`**
Re-style tool selector buttons into cyber toggle pills with live status dots (Idle, Running, Done, Failed) styled using theme CSS variables.

- [ ] **Step 3: Overhaul `VulnerabilityTable.tsx`**
Enhance severity styling (Critical: glowing red, High: neon amber, Medium: gold, Low: blue, Info: slate/cyan), search bar, column sorting, and full detail view drawer.

- [ ] **Step 4: Overhaul `FindingsSummary.tsx`**
Refactor metrics cards into bento-grid metric widgets showing total findings, critical count, live tool execution stats, and execution timer.

- [ ] **Step 5: Run typecheck**
Run: `npx tsc -b`
Expected: 0 errors

- [ ] **Step 6: Commit Dashboard & components redesign**
```bash
git add src/pages/Dashboard.tsx src/components/ScannerControls.tsx src/components/ToolSelection.tsx src/components/VulnerabilityTable.tsx src/components/FindingsSummary.tsx
git commit -m "feat(ui): complete Cyber Command Center bento dashboard redesign"
```

---

### Task 8: Quality Assurance, Full Verification & Final Production Build

**Files:**
- Modify: `package.json` (ensure version & build configurations are pristine)
- Output: `release/`

- [ ] **Step 1: Execute TypeScript compilation check**
Run: `npx tsc -b`
Expected: Exits with code 0 and zero errors.

- [ ] **Step 2: Execute Vite production build**
Run: `npm run build`
Expected: Compiles `dist/` and `dist-electron/` without bundling errors.

- [ ] **Step 3: Execute Electron Builder packaging**
Run: `npm run dist`
Expected: Successfully generates installer and portable executables in `release/`:
- `release/Recon App Setup *.exe`
- `release/Recon App *.exe`

- [ ] **Step 4: Verify generated releases**
Check file existence, non-zero file sizes, and update documentation / changelog.

- [ ] **Step 5: Final Git Commit**
```bash
git add package.json
git commit -m "release: finalize production build and v1.1.0 overhaul"
```
