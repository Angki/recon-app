# AI Security Analyst Suite & Local Ollama Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade ReconApp's AI capabilities into a comprehensive local security intelligence suite featuring automated Ollama model discovery, in-app diagnostic settings, structured SQLite findings synthesis (RAG-lite), 4 cyber analysis presets, and an interactive Security Copilot chat.

**Architecture:** The solution introduces backend model discovery and structured context synthesis in `AIService` (`electron/services/aiService.ts`), wires IPC channels in `electron/ipc.ts` and `electron/preload.ts`, enhances `src/pages/Settings.tsx` with dynamic model dropdowns and connection tests, and transforms `src/pages/Dashboard.tsx`'s AI tab into a multi-preset security hub with interactive copilot chat.

**Tech Stack:** Electron 42, React 19, TypeScript, Tailwind CSS, Ollama API (`/api/tags`, `/api/generate`, `/api/chat`), SQLite (better-sqlite3), Lucide icons.

---

### Task 1: AIService Backend Expansion (Discovery, Connection Testing, and Structured Context Synthesis)

**Files:**
- Modify: `electron/services/aiService.ts`
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/global.d.ts`
- Create: `tests/ai-service.test.ts`

- [ ] **Step 1: Write unit tests for AIService model discovery, connection test, and context synthesis**

```typescript
// tests/ai-service.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { aiService, isLoopbackHost } from '../electron/services/aiService';
import { dbService } from '../electron/services/database';

test('isLoopbackHost correctly validates local Ollama hosts', () => {
  assert.equal(isLoopbackHost('http://127.0.0.1:11434'), true);
  assert.equal(isLoopbackHost('http://localhost:11434'), true);
  assert.equal(isLoopbackHost('http://[::1]:11434'), true);
  assert.equal(isLoopbackHost('https://api.external.com'), false);
  assert.equal(isLoopbackHost('http://192.168.1.100:11434'), false);
});

test('synthesizeFindingsContext formats SQLite findings into structured markdown', () => {
  const scanId = 'test_ai_synth_scan';
  dbService.insertScan(scanId, 'http://test.local', 'COMPLETED', new Date().toISOString(), {});
  dbService.insertFindings(scanId, 'nuclei', [
    {
      id: 'cve-2024-test',
      name: 'SQL Injection in /api/v1/user',
      severity: 'critical',
      scanner: 'nuclei',
      url: 'http://test.local/api/v1/user?id=1',
      description: 'Error-based SQL injection detected',
      timestamp: new Date().toISOString()
    }
  ]);

  const context = aiService.synthesizeFindingsContext(scanId, 'http://test.local');
  assert.ok(context.includes('http://test.local'));
  assert.ok(context.includes('SQL Injection in /api/v1/user'));
  assert.ok(context.includes('CRITICAL'));

  dbService.deleteScan(scanId);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai-service.test.ts`
Expected: FAIL with `aiService.synthesizeFindingsContext is not a function`

- [ ] **Step 3: Implement methods in AIService (`electron/services/aiService.ts`)**

Add:
- `getLocalOllamaModels(baseUrl?: string): Promise<{ success: boolean; models: string[]; error?: string }>`
- `testConnection(provider?: string, baseUrl?: string): Promise<{ success: boolean; latencyMs: number; message: string }>`
- `synthesizeFindingsContext(scanId: string, targetUrl?: string): string`
- `analyzeScan(scanId: string, preset: string, customPrompt?: string): Promise<string>`
- `chatCopilot(scanId: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, message: string): Promise<string>`

- [ ] **Step 4: Wire IPC handlers in `electron/ipc.ts`, `electron/preload.ts`, and `src/types/global.d.ts`**

Register:
- `ai:getOllamaModels`
- `ai:testConnection`
- `ai:analyzeScan`
- `ai:chatCopilot`

- [ ] **Step 5: Run tests and verify they pass**

Run: `node --test tests/ai-service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add electron/services/aiService.ts electron/ipc.ts electron/preload.ts src/types/global.d.ts tests/ai-service.test.ts
git commit -m "feat(ai): add model discovery, connection diagnostic, and structured findings synthesizer"
```

---

### Task 2: In-App Settings Enhancement (Ollama Auto-Discovery & Diagnostics UI)

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `electron/services/settings.ts`

- [ ] **Step 1: Add AI model preference types to `AppSettings` in `electron/services/settings.ts`**

Ensure `aiModel`, `aiBaseUrl`, and `aiUseStructuredFindings` are supported in `AppSettings` with safe defaults (`aiModel: 'qwen2.5:7b'`, `aiBaseUrl: 'http://127.0.0.1:11434'`, `aiUseStructuredFindings: true`).

- [ ] **Step 2: Update `src/pages/Settings.tsx` with Model Selector & Diagnostics**

Add UI controls:
- Local Model dropdown with `🔄 Refresh Models` button that calls `window.api.getOllamaModels()`.
- Connection status badge with a `Test Connection` button.
- Toggle switch for `Use Structured Findings Context (RAG-lite)`.
- Base URL input field.

- [ ] **Step 3: Verify build and component render**

Run: `npm run build`
Expected: PASS with 0 TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.tsx electron/services/settings.ts
git commit -m "feat(settings): in-app ollama model auto-discovery dropdown and connection tester"
```

---

### Task 3: Preset Analysis Hub & Formatted Output in Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/ScannerControls.tsx`

- [ ] **Step 1: Implement Analysis Preset Prompts in `electron/services/aiService.ts`**

Define 4 cybersecurity prompts:
1. `executive`: Executive Risk Summary, business impact, CVSS score heuristics, top immediate risks.
2. `attack_path`: Exploit chaining & attack path reconstruction (linking recon ports, discovery endpoints, and DAST findings).
3. `remediation`: Concrete patching playbook (code examples for Nginx/Apache, PHP, Node, SQL parameterization, CSP/CORS headers).
4. `verification`: Manual verification & proof-of-concept testing steps with curl/CLI commands.

- [ ] **Step 2: Implement Preset Selector Bar and Markdown Renderer in `src/pages/Dashboard.tsx`**

Replace the plain `<pre>` box in the `activeTab === 'ai'` section with:
- Preset buttons toolbar: `[🛡️ Executive Summary] [⛓️ Attack Paths] [🔧 Remediation Playbook] [🧪 Manual Verification]`.
- Active model indicator badge (`Model: sast-qwen3.5-9b` or configured model).
- Structured Markdown display with syntax highlighting, copyable code blocks, and a "Copy Full Report" button.

- [ ] **Step 3: Test preset analysis trigger and UI responsiveness**

Run: `npm run test`
Expected: All existing tests and gate suites pass.

- [ ] **Step 4: Commit**

```bash
git add electron/services/aiService.ts src/pages/Dashboard.tsx src/components/ScannerControls.tsx
git commit -m "feat(dashboard): add 4 cybersecurity analysis presets and markdown report rendering"
```

---

### Task 4: Interactive Security Copilot Chat

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `electron/services/aiService.ts`

- [ ] **Step 1: Implement Copilot chat method in `AIService`**

Ground conversation in target context and findings summary, keeping track of multi-turn user/assistant conversation history.

- [ ] **Step 2: Build Copilot Chat Drawer UI in `src/pages/Dashboard.tsx`**

Add an expandable conversation panel under the analysis report:
- Chat history display with user and assistant message bubbles.
- Quick prompt chips: *"How to verify critical finding?"*, *"Generate Nginx patch"*, *"Explain CVSS score"*.
- Input box with Send button and loading spinner.

- [ ] **Step 3: Test interactive chat IPC and frontend state flow**

Run: `npm run build`
Expected: Clean build without errors.

- [ ] **Step 4: Commit**

```bash
git add electron/services/aiService.ts src/pages/Dashboard.tsx
git commit -m "feat(ai): interactive security copilot chat grounded in scan findings"
```

---

### Task 5: End-to-End Verification & Distribution Build

**Files:**
- Run test runner: `node scripts/test-isolated.cjs`
- Package app: `npx electron-builder`

- [ ] **Step 1: Run complete test suite**

Run: `npm run test`
Expected: 108+ tests PASS (0 failures).

- [ ] **Step 2: Build release binaries**

Run: `npm run dist`
Expected: Generates signed `Recon App Setup 1.0.0.exe` and `Recon App 1.0.0.exe` in `release/`.

- [ ] **Step 3: Final Commit and Git Push**

```bash
git push origin main
```
