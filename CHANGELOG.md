# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-06-12

### Added
- **Acunetix Docker Integration**: Automated Docker container detection, API polling, and comprehensive PDF & XML report generation via `acunetix_runner.js`.
- **WPScan Docker Support**: Integrated WPScan execution via Docker volume mapping.
- **Auto-Ollama Setup**: Added automated local Ollama daemon execution (`ollama serve`) and model pulling (`/api/pull`) when connecting to `127.0.0.1` inside `aiService.ts`.

### Fixed
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
