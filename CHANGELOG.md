# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-10-22

### Added
- **Findings Triage Workflow**: Findings can now be marked as Open, False Positive, Accepted Risk, or Fixed per deterministic fingerprint, with an analyst reason, actor, optional expiry, and a visible audit trail in the findings table. Decisions persist in `triage_decisions` and influence baseline comparisons.
- **Baseline Differential**: History now exposes a Diff action that compares a scan against an earlier completed baseline, reporting new, persistent, resolved, reopened, and not-reassessed findings. Failed or interrupted runs never assert resolution.
- **Acunetix Docker Integration**: Automated Docker container detection, API polling, and comprehensive PDF & XML report generation via `acunetix_runner.js`.
- **WPScan Docker Support**: Integrated WPScan execution via Docker volume mapping.
- **Auto-Ollama Setup**: Added automated local Ollama daemon execution (`ollama serve`) and model pulling (`/api/pull`) when connecting to `127.0.0.1` inside `aiService.ts`.
- **Accessible Dialogs and Toasts**: Added a shared modal primitive with `role="dialog"`, focus trapping, Escape handling, and focus restoration, plus a non-blocking toast system with `aria-live` feedback. The update pipeline and dependency dialogs now use this primitive.
- **Tool Integration Guide**: Added `docs/enterprise/ADDING-A-TOOL.md` with the manifest, adapter, parser, UI, installer, test, and documentation checklist for adding a scanner.
- **On-Demand Terminal Bundle**: The xterm-based live console is now loaded lazily only when the Live workspace is opened. The initial renderer chunk dropped from ~801 kB to ~476 kB, removing the Vite chunk-size warning without delaying the first screen.

### Fixed
- **Reactive Workspace Navigation**: Sidebar workflow steps, dashboard tabs, and the Findings summary now share one workspace state, so active highlighting and `aria-current` stay in sync with the visible view. Workspace and live-console selectors now expose tablist/tab/tabpanel semantics.
- **Blocking Browser Alerts**: Replaced all `alert()` calls in scan validation and tool selection with dismissible toast notifications, and report export failures are now shown inline in the export dialog.
- **Electron Production Sandbox**: Chromium network-sandbox relaxation is now limited to Windows development mode; production builds run with `sandbox: true`.
- **Fail-Closed Commercial Scans**: Acunetix scans that fail, abort, lose their result session, or cannot fetch vulnerabilities now write an explicit inconclusive marker and exit non-zero. Netsparker now propagates the child process exit code through its PowerShell wrapper, and both adapters reject missing report artifacts instead of reporting zero findings.
- **No Silent Adapter Fallback**: Unknown scanner names are rejected at scan start and `getAdapter()` no longer falls back to an unverified command.
- **Path Traversal in Tool Management**: Rollback, uninstall, and virtualenv resolution only accept catalog-managed tool ids and enforce containment inside the managed directories.
- **Secret Leakage in Diagnostics**: Startup command logs redact `--api-token` / `-token` style arguments and URL-embedded credentials; `interactshToken` is now masked by `getPublic()`.
- **Release Integrity Documentation**: README checksums now match the verification build, `npm run dist` regenerates `release/SHA256SUMS`, and the missing MIT `LICENSE` file was added.
- **Terminal Crash Bug**: Fixed `TypeError: Cannot read properties of undefined (reading 'dimensions')` in `xterm.js` by deferring `fit()` execution using `requestAnimationFrame`.
- **Random UI Refreshes**: Prevented unintended page reloads by explicitly preventing default form submission (`e.preventDefault()`) on Enter keydown events in `TerminalPane` and `ScannerControls`.
- **WPScan Missing Output**: Fixed an issue where WPScan would fail silently by appending `--force` and `--disable-tls-checks` arguments to the Docker run command.
- **Hidden Terminal Lifecycles**: Migrated `Dashboard.tsx` tab switching logic from `display: none` to CSS `opacity/z-index` to preserve DOM geometry for `xterm.js` calculations.

## [1.1.0] - 2026-06-09

### Added
- **Commercial Scanners Integration**: Added full support for HCL AppScan Standard and Invicti Netsparker.
- **XML Parsing**: Integrated `fast-xml-parser` to parse XML reports from AppScan and Netsparker, merging their results into the unified Findings table.
- **ProjectDiscovery Unified Tab**: Consolidated logs from all ProjectDiscovery suite tools (Subfinder, Httpx, Alterx, DNSx, Naabu, TLSx, Katana) into a single, neat `pdiscovery` terminal tab.
- **AI Security Analyst Improvements**: 
  - Added support for Google Gemini, OpenAI, and Anthropic alongside local Ollama models.
  - Implemented loading states and robust error handling for API connection issues.
- **Extensive Tool Support**: Expanded from just Nuclei and Wapiti to include Nmap, ZAP, FFUF, and the full ProjectDiscovery suite.
- **Dynamic Settings UI**: Configurable paths for all newly added tools, wordlists, and custom templates.
- **Clickable URLs**: Added double-click-to-open functionality for URLs in the Findings table via an Electron `shell:openExternal` IPC bridge.
- **Enhanced Log Filtering**: Automatically strips noisy ANSI escape codes from CLI outputs before parsing them for AI or UI rendering.

### Fixed
- Fixed bug causing false positive vulnerability detection by refining Wapiti's output regex parsing.
- Resolved AI analysis fetch failures when Ollama was offline by introducing explicit user-facing error messages.
- Fixed UI layout breaking on smaller screens.
- Fixed an issue where `fast-xml-parser` duplicated React keys in the settings page.

### Changed
- Excluded commercial tools (AppScan, Netsparker) from the automatic open-source updater feature in `updater.ts`.
- Renamed project context file from `.context` to `.context.md` for better Markdown editor support.

## [1.0.0] - Initial Release

### Added
- Created the core Electron application wrapper.
- Integrated Nuclei and Wapiti concurrent execution using `child_process.spawn`.
- Built the React, TypeScript, and TailwindCSS frontend.
- Added real-time terminal panes using `xterm.js`.
- Implemented the automated scanning directory and report JSON parsing mechanism.
