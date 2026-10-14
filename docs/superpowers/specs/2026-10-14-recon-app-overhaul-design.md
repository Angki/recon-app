# Specification: SecOps Recon App Overhaul & Engine Modernization

## 1. Overview & Objectives
This specification outlines the comprehensive overhaul of **SecOps Recon**, an Electron-based Application Security orchestration platform. The project aims to modernize the user interface into a futuristic, high-productivity **Cyber Command Center** with multi-theme support (Dark Slate, Light Clean, Obsidian, and Liquid Glass), upgrade internal security tooling orchestration (Nuclei, Wapiti, ProjectDiscovery suite), install development and design skills, and evaluate the application through to final production packaging (`.exe` NSIS and Portable).

---

## 2. Open-Source Skills Installation
Two curated skills are integrated into `.agents/skills/` to standardize development and design practices:
1. **`electron-pro`** (`.agents/skills/electron-pro/SKILL.md`):
   - Secure desktop application architecture: strict IPC boundary using `contextBridge`, zero `nodeIntegration` in renderer, leak-free child process lifecycle management, terminal buffer batching, and production packaging best practices.
2. **`cyber-ui-theme`** (`.agents/skills/cyber-ui-theme/SKILL.md`):
   - Design system specifications for cyber-security command centers: CSS custom property tokens, glassmorphism rules (`backdrop-filter: blur()`, border gradients), high-contrast accessibility across themes, and responsive bento-grid layouts.

---

## 3. UI/UX Architecture & Multi-Theme System

### 3.1 CSS Custom Property Theme Engine
The application enforces theme styling via `data-theme` on the root `<html>` element with seamless switching and persistence in `localStorage`:
- **`dark` (Dark Slate - Default)**: Deep slate background (`#0f172a`), slate-800 surfaces, sharp emerald and blue accents.
- **`light` (Light Clean)**: Silver-white canvas (`#f8fafc`), clean white card panels, dark gray high-contrast typography, crisp borders.
- **`obsidian` (Obsidian Void)**: Ultra-deep black background (`#07070a`), carbon gray container layers (`#12131d`), neon cyan (`#00f0ff`) and electric violet (`#a855f7`) accents with subtle luminous borders.
- **`glass` (Liquid Glassmorphism)**: Translucent dark panels with `backdrop-filter: blur(16px)`, iridescent borders (`rgba(255,255,255,0.1)`), glowing hover states, and ambient gradient backdrops.

### 3.2 Layout & Component Hierarchy
1. **Top Header & Telemetry Bar**:
   - System telemetry indicators (active scan state, memory/process counter).
   - Instant Theme Switcher dropdown (Sun, Moon, Terminal, Glass icons).
   - Window control integration / title bar drag region.
2. **Collapsible Command Sidebar**:
   - Sleek navigation links with glow badges: Dashboard (Scanner), Engine Health & Tools, Scan History, AI Log Analyzer, Settings.
3. **Dashboard (Cyber Command Center)**:
   - **Target Quick Bar**: Smart URL validator with protocol auto-fix, Scan Profile selector (Quick Recon, Full DAST, WP Audit, Custom).
   - **Tool Selector Matrix**: Toggle pills with live status badges (Idle, Running, Done, Failed) for all tools: Nuclei, Wapiti, Subfinder, HTTPX, Naabu, Katana, DNSX, Alterx, TLSX, FFUF, Nmap, ZAP.
   - **Adaptive Split Workspace**:
     - **Interactive Terminal Pane (Xterm.js)**: Automatically adapts terminal theme colors (background, foreground, cursor, ansi colors) based on the active app theme.
     - **Live Findings Explorer**: Filterable vulnerability table with severity badges (Critical, High, Medium, Low, Info), instant search, and findings detail drawer.

---

## 4. Hybrid Smart Tool Engine & Updater

### 4.1 Supported Security Tool Suite
- **Nuclei**: Vulnerability scanner engine (`projectdiscovery/nuclei`) + automatic template database updates (`-update-templates`).
- **Wapiti**: Web application vulnerability scanner (`pip install --upgrade wapiti3`).
- **ProjectDiscovery Suite**:
  - `subfinder`: Subdomain discovery.
  - `httpx`: HTTP probing and tech detection.
  - `naabu`: Port scanning.
  - `katana`: Web crawling & endpoint spidering.
  - `dnsx`: Multi-purpose DNS toolkit.
  - `alterx`: Fast subdomain permutation.
  - `tlsx`: TLS/SSL connection probing.
- **FFUF**: Web fuzzing utility (`ffuf/ffuf`).
- **Nmap & ZAP**: Path detection, status check, and guided configuration.

### 4.2 Dual-Layer Update Mechanism (`electron/services/toolManager.ts`)
1. **Health & Version Matrix**:
   - Queries current local version (via CLI execution or binary inspection).
   - Fetches latest GitHub release tags (`api.github.com/repos/.../releases/latest`) with rate-limit protection.
2. **Resilient Update Pipeline**:
   - **Layer 1 (Native CLI flags)**: Executes `tool -update` and `pip install --upgrade wapiti3`.
   - **Layer 2 (Direct GitHub Release Downloader)**: If Layer 1 fails (due to Windows binary file locks, missing Go runtime, or permission issues), the engine automatically downloads the official release `.zip`, extracts binaries safely into `%APPDATA%/ReconApp/bin`, and updates path mappings.
3. **Engine & Tools Hub (UI)**:
   - Dedicated dashboard tab displaying the status, path, and version of each tool, with individual and "Update All" action buttons.

---

## 5. Quality Assurance, Evaluation & Build Packaging

### 5.1 Verification Matrix
- **Type Checking**: Full TypeScript verification (`npx tsc -b`) for both Electron backend and React frontend.
- **Build Verification**: Production frontend bundling with Vite (`npm run build`).
- **Runtime Sanity Checks**:
  - Theme switching transitions across all 4 themes without layout breaks.
  - Terminal auto-fitting and theme color synchronization.
  - Tool health reporting via IPC.

### 5.2 Final Build Delivery
- Packaging through `electron-builder` (`npm run dist`):
  - **NSIS Windows Installer**: `release/Recon App Setup *.exe`.
  - **Portable Executable**: `release/Recon App *.exe`.
