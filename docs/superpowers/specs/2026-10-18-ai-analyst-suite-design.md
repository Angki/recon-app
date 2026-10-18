# AI Security Analyst Suite & Local Ollama Integration Design

## Overview
This design document establishes the architecture, IPC interfaces, data flow, and UI components for upgrading the AI Security Analyst feature in ReconApp. It replaces noisy raw terminal parsing with structured security finding synthesis (RAG-lite), introduces automated local Ollama model auto-discovery with in-app settings, provides 4 specialized security analysis presets (inspired by the open-source Fabric framework), and adds an interactive Security Copilot chat interface.

## 1. Objectives & Requirements
1. **Ollama Auto-Discovery & Settings**:
   - Provide an in-app "Refresh / Detect Local Models" capability querying `GET /api/tags` from the local Ollama daemon (`http://127.0.0.1:11434`).
   - Populate a model selector dropdown allowing the user to select any local model (e.g. `sast-qwen3.5-9b-32k-nothink`, `sast-qwen3.5-4b-32k-fast`, `qwen2.5:7b`).
   - Provide a "Test Connection" button with latency and status feedback.
   - Support in-app AI preferences: analysis mode (Structured Findings vs Raw Logs) and temperature/timeout.
2. **Context Synthesis Engine (RAG-lite)**:
   - Instead of passing raw terminal ANSI logs, query SQLite `findings` and `endpoints` for the active scan.
   - Aggregate findings by severity (Critical, High, Medium, Low, Info) with tool, URL, parameter, CWE, CVE, and proof evidence.
   - Format into a clean, token-efficient Markdown evidence context.
3. **Multi-Preset Security Analysis**:
   - Preset 1: 🛡️ **Executive Risk Summary** (CVSS risk matrix, business impact, critical vulnerability summary).
   - Preset 2: ⛓️ **Attack Path & Exploit Chaining** (Correlate recon, open ports, and vulnerabilities into multi-stage attack scenarios).
   - Preset 3: 🔧 **Remediation & Patching Playbook** (Exact code/configuration snippets for Nginx, Apache, PHP, Node, SQLi, CORS).
   - Preset 4: 🧪 **Active Verification Guide** (Reproduction steps, curl payloads, test commands).
4. **Interactive Security Copilot (Chat)**:
   - Provide an interactive chat drawer directly in the AI Analyst tab allowing operators to ask follow-up questions grounded in the current scan findings.
5. **Safety & Privacy Guardrails**:
   - Maintain the `local-only` policy when Ollama is selected (blocking external network requests).
   - Sanitize sensitive tokens, Bearer headers, and secrets before passing context to the model.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       RECONAPP UI                           │
│                                                             │
│  [Settings Page]                  [Dashboard: AI Tab]       │
│  - Ollama Model Discovery         - 4 Analysis Presets      │
│  - Connection Test                - Formatted Markdown Box  │
│  - Preferences Toggle             - Security Copilot Chat   │
└──────────────────────────────┬──────────────────────────────┘
                               │ IPC Channels
┌──────────────────────────────▼──────────────────────────────┐
│                  ELECTRON MAIN PROCESS                      │
│                                                             │
│  [AIService]                                                │
│  ├── getLocalOllamaModels(): Promise<string[]>              │
│  ├── testOllamaConnection(): Promise<{ok, latencyMs, models}>│
│  ├── synthesizeFindingsContext(scanId): string              │
│  ├── analyzeScan(scanId, preset, customPrompt?): Promise    │
│  └── chatCopilot(scanId, history, message): Promise<string> │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP /api/generate & /api/tags
┌──────────────────────────────▼──────────────────────────────┐
│                 LOCAL OLLAMA DAEMON                         │
│  (127.0.0.1:11434 - SAST Qwen / General LLMs)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data Contracts & IPC Interface

### IPC Channels (`electron/ipc.ts` & `electron/preload.ts`)
1. `ai:getOllamaModels`:
   - Returns: `{ success: boolean; models: string[]; error?: string }`
2. `ai:testConnection`:
   - Parameters: `{ baseUrl?: string; provider?: string }`
   - Returns: `{ success: boolean; latencyMs: number; message: string }`
3. `ai:analyzeScan`:
   - Parameters: `{ scanId: string; preset: 'executive' | 'attack_path' | 'remediation' | 'verification'; customPrompt?: string }`
   - Returns: `string` (Markdown report)
4. `ai:chatCopilot`:
   - Parameters: `{ scanId: string; history: Array<{ role: 'user' | 'assistant'; content: string }>; message: string }`
   - Returns: `string`

---

## 4. UI Design & Components

1. **`src/pages/Settings.tsx`**:
   - Under "AI Executive Analysis", when `aiProvider === 'ollama'`:
     - Base URL field (defaults to `http://127.0.0.1:11434`).
     - "Test Connection" button with badge indicator (green ping or red error).
     - Model selector dropdown populated dynamically from `ai:getOllamaModels`, with fallback manual input.
     - "Refresh Models" button next to dropdown.
     - Toggle: "Use Structured SQLite Findings (RAG-lite)" (enabled by default).
2. **`src/pages/Dashboard.tsx` (AI Analyst Tab)**:
   - Header with active target info and model badge.
   - Preset buttons toolbar:
     - [🛡️ Executive Summary] [⛓️ Attack Paths] [🔧 Patching Guide] [🧪 Verification]
   - Markdown viewer with code syntax blocks and one-click "Copy Report" button.
   - Collapsible / dedicated "Security Copilot Chat" section with chat bubbles and prompt suggestions (e.g., *"How do I fix the highest severity finding?"*, *"Create a curl command to verify finding X"*).

---

## 5. Verification & Test Plan
- Unit test suite testing `AIService.synthesizeFindingsContext` with mock findings.
- Unit test verifying Ollama error handling and response extraction.
- Unit test verifying local-only policy blocking external URLs.
- All existing 107 gate tests remain 100% green.
