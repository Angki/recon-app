# Resonix Security Suite 🛡️

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Electron](https://img.shields.io/badge/Electron-42.3-lightgrey.svg?logo=electron)
![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg?logo=typescript)
![SQLite](https://img.shields.io/badge/Storage-SQLite3%20WAL-emerald.svg?logo=sqlite)

**Resonix Security Suite** is an enterprise-grade desktop cybersecurity command center built on Electron, React, and high-performance native SQLite. It unifies reconnaissance, active attack surface discovery, parameter fuzzing, and dynamic application security testing (DAST) into an automated, chained workflow designed for penetration testers, security engineers, and red teams.

---

## ⚡ Key Highlights

### 🔄 Intelligent Discovery-to-DAST Pipeline Chaining
- **Automated Recon -> DAST Pipeline**: When crawlers (**Katana**, **GAU**, **Arjun**) discover active endpoints and parameters, Resonix automatically compiles them and feeds them directly into deep audit engines (**Nuclei** via target lists and **Dalfox** via file mode).
- **Phased Execution**: Prevents WAF rate-limiting and connection saturation by executing in structured stages:
  1. *Passive Recon & DNS Profiling*: Subfinder, AlterX, DNSX, Naabu, Wafw00f, CMSeeK.
  2. *Active Crawling & Endpoint Discovery*: Katana, GAU, FFUF.
  3. *Parameter Mining & Fuzzing*: Arjun, CRLFSuite, Corsy, Schemathesis.
  4. *Deep DAST & Vulnerability Auditing*: Nuclei, Wapiti, Dalfox, OWASP ZAP, WPScan, SQLmap, Commix.

### 🛡️ Enterprise Attack Surface & Endpoint Inventory
- **Centralized Endpoint Repository**: View, filter, and inspect discovered endpoints, methods, parameters, and discovery sources in real time.
- **Active Retest Workflow**: Directly dispatch targeted active verification (SQLmap, Dalfox, CRLFSuite, Commix) against specific endpoints from the UI.
- **Deduplication & Fingerprinting**: Automatic finding fingerprinting ensures reliable baseline diffing and resolution tracking across repeat assessments.

### 💾 High-Throughput SQLite Storage Engine
- **Idempotent Versioned Migrations**: Automated database schema migrations (v1 to v5) ensure backward compatibility and zero data corruption.
- **WAL Mode & Streaming Buffer Protection**: Safe parsing for discovery outputs up to hundreds of megabytes with strict buffer slicing.
- **Automated Backups & Retention**: Rolling SQLite backups with integrity checks and configurable retention policies.

### 📑 Comprehensive Compliance & Reporting
- **OASIS SARIF 2.1.0 Export**: Full compliance for CI/CD integration with GitHub Code Scanning, GitLab Security, and DefectDojo.
- **Executive HTML Reports**: Print-ready, professionally styled audits with executive vulnerability summaries and remediation recommendations.
- **Technical Exports**: Detailed JSON and Markdown reporting with risk heuristics and reproduction commands.

### 🎨 Cyber Command Center UI
- **Multi-Theme Engine**: Seamless toggle between *Obsidian Obsidian*, *Glassmorphism Cyber*, *Modern Dark*, and *High-Contrast Light* themes.
- **Real-Time Terminal Streams**: High-performance xterm.js integration with search, auto-scroll, and ansi color support.
- **AI Triage & Analysis**: Local Ollama execution (Llama 3, Mistral) and cloud providers (OpenAI, Claude, Gemini) for contextual finding analysis.

---

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│               React 19 Renderer (UI / Control Plane)            │
│  Bento Dashboard • Tools Hub • Endpoint Inventory • Live Term   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ ContextBridge IPC (Safe Boundary)
┌───────────────────────────────▼─────────────────────────────────┐
│               Electron Main Process (Security Core)             │
│  Scanner Orchestrator • Tool Catalog • Process Sandboxing       │
└───────┬───────────────────────┬─────────────────────────┬───────┘
        │                       │                         │
┌───────▼──────────────┐ ┌──────▼──────────────────┐ ┌────▼───────┐
│  Scanner Adapters    │ │ SQLite Native Database  │ │ AI Service │
│  (25+ CLI Tools)     │ │ WAL Mode • Migrations   │ │ Ollama/API │
└──────────────────────┘ └─────────────────────────┘ └────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v20.0.0 or higher, v24 LTS recommended)
- **Git**

### 2. Installation
```bash
git clone https://github.com/Angki/recon-app.git
cd recon-app
npm install
```

### 3. Running in Development
```bash
npm run dev
```

### 4. Running Verification Test Suite
```bash
npm run test
```
*Executes the complete test suite across all 5 verification phases.*

---

## 📦 Packaging & Distribution

To build the standalone Windows installer and portable executable:

```bash
npm run dist
```

Artifacts will be produced in the `release/` directory:
- **Installer**: `release/Resonix Security Suite Setup 1.0.0.exe`
- **Portable**: `release/Resonix Security Suite 1.0.0.exe`

---

## ⚖️ License & Disclaimer

**Resonix Security Suite is designed strictly for authorized penetration testing, vulnerability assessment, and educational research.**
Explicit written permission from asset owners must be obtained before scanning. The developers and contributors assume no liability for misuse.

Released under the [MIT License](LICENSE).
