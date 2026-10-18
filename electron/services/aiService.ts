import { logger } from './logger';
import { settingsStore } from './settings';
import { dbService } from './database';
import { exec } from 'child_process';
import type * as Electron from 'electron';

export function isLoopbackHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

export const AI_PRESETS: Record<string, string> = {
  executive: `Act as a Principal Cybersecurity Consultant. Based on the target and structured scan findings below, generate a professional Executive Risk Summary. Include:
1. Executive Summary & Overall Risk Posture (Grade: Critical/High/Medium/Low)
2. Top 3 Immediate Business Impacts
3. Attack Surface Overview
4. High-Level Strategic Next Steps for Leadership`,

  attack_path: `Act as an Adversary Simulation / Red Team Lead. Analyze the structured scan findings and open attack surface below to reconstruct realistic attack chaining paths.
1. Chain recon data (open ports, discovered endpoints) with DAST vulnerabilities.
2. Step-by-step Attack Narrative: Initial Access -> Execution -> Privilege Escalation / Data Exfiltration.
3. Identify the Single Point of Failure or primary choke point to neutralize the chain.`,

  remediation: `Act as a Senior SecOps / DevSecOps Engineer. For each confirmed finding and vulnerability below, provide concrete, actionable technical remediation instructions:
1. Configuration & Code Patching (Provide realistic configuration snippets for Nginx/Apache/Cloudflare or code patterns for PHP/Node/Python).
2. Defensive Headers & Sanitization Rules (e.g. CSP, CORS, input validation, prepared statements).
3. Verification command to prove the fix works.`,

  verification: `Act as a Penetration Tester conducting quality verification. For the reported findings below:
1. Provide safe, non-destructive manual verification commands (curl, nmap, nuclei flags, or browser devtools instructions).
2. Explain expected responses that confirm true positive vs false positive.
3. Highlight any potential false positives common to these scanners.`
};

export class AIService {
  async getLocalOllamaModels(customBaseUrl?: string): Promise<{ success: boolean; models: string[]; error?: string }> {
    const settings = settingsStore.get();
    let baseUrl = customBaseUrl || settings.aiBaseUrl || 'http://127.0.0.1:11434';
    baseUrl = baseUrl.replace('http://localhost', 'http://127.0.0.1');

    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) {
        return { success: false, models: [], error: `Ollama returned HTTP ${res.status}` };
      }
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const models = (data.models || []).map(m => m.name);
      return { success: true, models };
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, models: [], error: error.message || 'Failed to reach Ollama' };
    }
  }

  async testConnection(customProvider?: string, customBaseUrl?: string): Promise<{ success: boolean; latencyMs: number; message: string; modelCount?: number }> {
    const settings = settingsStore.get();
    const provider = customProvider || settings.aiProvider || 'ollama';
    let baseUrl = customBaseUrl || settings.aiBaseUrl || 'http://127.0.0.1:11434';
    baseUrl = baseUrl.replace('http://localhost', 'http://127.0.0.1');

    const startTime = Date.now();
    try {
      if (provider === 'ollama') {
        const res = await fetch(`${baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(4000)
        });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          return { success: false, latencyMs, message: `Ollama returned HTTP ${res.status}` };
        }
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        const count = (data.models || []).length;
        return {
          success: true,
          latencyMs,
          modelCount: count,
          message: `Connected to Ollama (${count} model${count === 1 ? '' : 's'} available)`
        };
      } else if (provider === 'gemini') {
        const apiKey = settings.aiApiKey;
        if (!apiKey) return { success: false, latencyMs: 0, message: 'Gemini API key missing' };
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) return { success: false, latencyMs, message: `Gemini API error: HTTP ${res.status}` };
        return { success: true, latencyMs, message: 'Connected to Gemini API' };
      } else if (provider === 'openai') {
        const apiKey = settings.aiApiKey;
        if (!apiKey) return { success: false, latencyMs: 0, message: 'OpenAI API key missing' };
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000)
        });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) return { success: false, latencyMs, message: `OpenAI API error: HTTP ${res.status}` };
        return { success: true, latencyMs, message: 'Connected to OpenAI API' };
      } else if (provider === 'anthropic') {
        const apiKey = settings.aiApiKey;
        if (!apiKey) return { success: false, latencyMs: 0, message: 'Anthropic API key missing' };
        return { success: true, latencyMs: 1, message: 'Anthropic API key configured' };
      } else {
        return { success: false, latencyMs: 0, message: `Unsupported provider: ${provider}` };
      }
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: `Connection failed: ${error.message || 'Network error'}`
      };
    }
  }

  synthesizeFindingsContext(scanId: string, fallbackTarget?: string): string {
    const scan = dbService.getScanById(scanId);
    const target = scan?.target || fallbackTarget || 'Unknown Target';
    const findings = dbService.getFindings(scanId);

    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) {
      const sev = String(f.severity || 'info').toLowerCase() as keyof typeof counts;
      if (counts[sev] !== undefined) counts[sev]++;
      else counts.info++;
    }

    let context = `# Target Security Assessment: ${target}\n`;
    context += `- **Scan ID**: ${scanId}\n`;
    context += `- **Total Findings**: ${findings.length} (Critical: ${counts.critical}, High: ${counts.high}, Medium: ${counts.medium}, Low: ${counts.low}, Info: ${counts.info})\n\n`;

    if (findings.length > 0) {
      context += `## Key Findings & Vulnerabilities\n`;
      const topFindings = findings.slice(0, 50);
      for (const f of topFindings) {
        const sev = String(f.severity || 'info').toUpperCase();
        const name = f.name || f.type || 'Unknown';
        const scanner = f.scanner || 'unknown';
        const url = f.url || '';
        const desc = f.description || '';
        context += `### [${sev}] ${name} (Scanner: ${scanner})\n`;
        if (url) context += `- **Target URL**: ${url}\n`;
        if (desc) context += `- **Description**: ${desc.slice(0, 300)}\n`;
        if (f.param) context += `- **Vulnerable Parameter**: ${f.param}\n`;
        if (f.cve || f.id) context += `- **Ref/CVE**: ${f.cve || f.id}\n`;
        context += `\n`;
      }
      if (findings.length > 50) {
        context += `*...and ${findings.length - 50} more lower-severity findings omitted for context length.*\n\n`;
      }
    } else {
      context += `## Vulnerability Findings\nNo automated vulnerabilities detected by active scanners.\n\n`;
    }

    try {
      const db = dbService.getRawDatabase();
      const endpoints = db.prepare('SELECT method, url, parameters FROM endpoints WHERE scanId = ? AND inScope = 1 LIMIT 25').all(scanId) as Array<{ method: string; url: string; parameters?: string }>;
      if (endpoints && endpoints.length > 0) {
        context += `## Discovered Attack Surface (Sample Endpoints)\n`;
        for (const ep of endpoints) {
          let paramStr = '';
          try {
            const params = JSON.parse(ep.parameters || '[]');
            if (params.length > 0) paramStr = ` [Params: ${params.join(', ')}]`;
          } catch { /* ignore */ }
          context += `- ${ep.method} ${ep.url}${paramStr}\n`;
        }
        context += `\n`;
      }
    } catch {
      // endpoints table might not exist or query fail in isolated test
    }

    return context;
  }

  async analyzeScan(
    sender: Electron.WebContents | null,
    scanId: string,
    preset: string,
    customPrompt?: string
  ): Promise<string> {
    const basePrompt = AI_PRESETS[preset] || customPrompt || AI_PRESETS.executive;
    const structuredContext = this.synthesizeFindingsContext(scanId);

    const fullPrompt = `${basePrompt}\n\n${structuredContext}`;
    return this.analyzeLogs(sender as Electron.WebContents, '', fullPrompt);
  }

  async chatCopilot(
    sender: Electron.WebContents | null,
    scanId: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    message: string
  ): Promise<string> {
    const settings = settingsStore.get();
    const provider = settings.aiProvider || 'ollama';
    const policy = settings.aiPolicy || 'local-only';
    const apiKey = settings.aiApiKey;

    if (policy === 'local-only') {
      if (provider !== 'ollama') {
        throw new Error(`AI Policy Violation: Policy is set to 'local-only'. Cloud provider '${provider}' is blocked.`);
      }
      const baseUrl = settings.aiBaseUrl || 'http://127.0.0.1:11434';
      if (!isLoopbackHost(baseUrl)) {
        throw new Error(`AI Policy Violation: 'local-only' policy forbids external endpoint '${baseUrl}'.`);
      }
    }

    const context = this.synthesizeFindingsContext(scanId);
    const systemPrompt = `You are Recon App Security Copilot, an elite defensive cybersecurity advisor. You assist security analysts in triaging findings, drafting fixes, and investigating attack surfaces. Base all answers strictly on the following scan context and technical facts:\n\n${context}`;

    if (provider === 'ollama') {
      return this.callOllamaChat(sender, settings.aiBaseUrl, settings.aiModel, systemPrompt, history, message);
    } else if (provider === 'openai') {
      return this.callOpenAIChat(apiKey, systemPrompt, history, message);
    } else {
      // Fallback: format into a single prompt for general LLM call
      const conversationText = history.map(h => `${h.role === 'user' ? 'User' : 'Copilot'}: ${h.content}`).join('\n');
      const compositePrompt = `${systemPrompt}\n\nPrior Conversation:\n${conversationText}\n\nUser Question:\n${message}`;
      return this.analyzeLogs(sender as Electron.WebContents, '', compositePrompt);
    }
  }

  private async callOllamaChat(
    sender: Electron.WebContents | null,
    configuredBaseUrl: string,
    configuredModel: string,
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    message: string
  ): Promise<string> {
    let baseUrl = configuredBaseUrl || 'http://127.0.0.1:11434';
    const model = configuredModel || 'qwen2.5:7b';
    baseUrl = baseUrl.replace('http://localhost', 'http://127.0.0.1');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    sender?.send?.('ai:progress', `Copilot querying local model (${model})...`);

    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false
        }),
        signal: AbortSignal.timeout(90000)
      });

      if (!res.ok) {
        throw new Error(`Ollama chat error: HTTP ${res.status}`);
      }

      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content || 'No response generated.';
    } catch (err: unknown) {
      const error = err as Error;
      throw new Error(`Copilot chat failed: ${error.message || 'Unknown error'}`, { cause: err });
    }
  }


  private async callOpenAIChat(
    apiKey: string,
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    message: string
  ): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: message }
        ]
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI API Error: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || 'No response generated.';
  }

  async analyzeLogs(sender: Electron.WebContents | null, logs: string, prompt: string): Promise<string> {
    const settings = settingsStore.get();
    const provider = settings.aiProvider || 'ollama';
    const policy = settings.aiPolicy || 'local-only';
    const apiKey = settings.aiApiKey;

    // Enforce local-only policy
    if (policy === 'local-only') {
      if (provider !== 'ollama') {
        throw new Error(`AI Policy Violation: Policy is set to 'local-only'. Cloud provider '${provider}' is blocked.`);
      }
      const baseUrl = settings.aiBaseUrl || 'http://127.0.0.1:11434';
      if (!isLoopbackHost(baseUrl)) {
        throw new Error(`AI Policy Violation: 'local-only' policy forbids external endpoint '${baseUrl}'.`);
      }
    }

    if (!apiKey && provider !== 'ollama') {
      throw new Error('AI API Key is not configured in Settings.');
    }

    try {
      if (provider === 'gemini') {
        return await this.callGemini(apiKey, logs, prompt);
      } else if (provider === 'openai') {
        return await this.callOpenAI(apiKey, logs, prompt);
      } else if (provider === 'anthropic') {
        return await this.callAnthropic(apiKey, logs, prompt);
      } else if (provider === 'ollama') {
        return await this.callOllama(sender, settings.aiBaseUrl, settings.aiModel, logs, prompt);
      } else {
        throw new Error(`Unknown AI Provider '${provider}'`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      logger.error(`AI Analysis failed: ${error.message}`, error);
      throw new Error(`AI Analysis failed: ${error.message}`, { cause: err });
    }
  }

  private async callGemini(apiKey: string, logs: string, prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{ text: `${prompt}\n\nLogs:\n${logs}` }]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
  }

  private async callOpenAI(apiKey: string, logs: string, prompt: string): Promise<string> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an advisory cybersecurity assistant. Your analysis is strictly informational and cannot modify finding severity or close issues.' },
        { role: 'user', content: `${prompt}\n\nLogs:\n${logs}` }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error: ${errText}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || 'No response generated.';
  }

  private async callAnthropic(apiKey: string, logs: string, prompt: string): Promise<string> {
    const url = 'https://api.anthropic.com/v1/messages';
    const payload = {
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: `${prompt}\n\nLogs:\n${logs}` }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API Error: ${errText}`);
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text || 'No response generated.';
  }

  private async callOllama(
    sender: Electron.WebContents | null,
    configuredBaseUrl: string,
    configuredModel: string,
    logs: string,
    prompt: string
  ): Promise<string> {
    let baseUrl = configuredBaseUrl || 'http://127.0.0.1:11434';
    const model = configuredModel || 'qwen2.5:7b';

    baseUrl = baseUrl.replace('http://localhost', 'http://127.0.0.1');

    const url = `${baseUrl}/api/generate`;
    let truncatedLogs = logs;
    let disclosure = '';
    if (logs.length > 15000) {
      truncatedLogs = logs.substring(logs.length - 15000);
      disclosure = '\n[NOTICE: Log stream truncated to most recent 15,000 characters for context budget]\n';
    }
    
    const isThinkingModel = model.toLowerCase().startsWith('qwen3');
    const advisoryHeader = 'Advisory role: Provide insights grounded strictly in the logs and finding evidence below. Do not attempt to reclassify severity or close issues.\n';
    const finalPrompt = isThinkingModel
      ? `/no_think\n${advisoryHeader}${prompt}${disclosure}\n\nLogs:\n${truncatedLogs}`
      : `${advisoryHeader}${prompt}${disclosure}\n\nLogs:\n${truncatedLogs}`;

    const OLLAMA_TIMEOUT_MS = 120_000;

    const payload = {
      model: model,
      prompt: finalPrompt,
      stream: true
    };

    sender?.send?.('ai:progress', `Querying local Ollama model (${model})...`);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS)
      });
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      if (err.name === 'TimeoutError') {
         throw new Error(`Connection to Ollama at ${baseUrl} timed out after ${OLLAMA_TIMEOUT_MS / 1000}s. When loading a model (${model}) into VRAM/RAM for the first time, check system resources or verify Ollama status.`, { cause: e });
      }
      if (err.message?.includes('fetch failed') || err.code === 'ECONNREFUSED') {
        if (baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost')) {
          try {
            sender?.send?.('ai:progress', `Starting local Ollama daemon...`);
            exec('ollama serve');
            await new Promise(r => setTimeout(r, 3000));
            response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS)
            });
          } catch {
            throw new Error(`Ollama is not running locally and could not be started. Please install it from https://ollama.com`);
          }
        } else {
          throw new Error(`Could not connect to Ollama at ${baseUrl}. (Internal: ${err.message || err.code})`, { cause: e });
        }
      } else {
        throw new Error(`Ollama Request Failed: ${err.message || err.code || err}`, { cause: e });
      }
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 500;
      if (status === 404) {
        sender?.send?.('ai:progress', `Model "${model}" not found locally. Downloading automatically (this may take a few minutes depending on your internet speed)...`);
        
        try {
          const pullRes = await fetch(`${baseUrl}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model })
          });
          
          if (!pullRes.ok) throw new Error("Pull failed: " + await pullRes.text());
          
          const reader = pullRes.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n').filter(l => l.trim());
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.status) {
                    let progressText = `Downloading ${model}: ${data.status}`;
                    if (data.total && data.completed) {
                      const percent = Math.round((data.completed / data.total) * 100);
                      progressText += ` (${percent}%)`;
                    }
                    sender?.send?.('ai:progress', progressText);
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
          
          sender?.send?.('ai:progress', `Download complete! Starting analysis...`);
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS)
          });
          
          if (!response.ok) {
            throw new Error(`Analysis failed after pulling model. Error: ${await response.text()}`);
          }
        } catch (pullError: unknown) {
          throw new Error(`Failed to automatically download model "${model}". Error: ${(pullError as Error).message}`, { cause: pullError });
        }
      } else {
        throw new Error(`Ollama API Error (${status})`);
      }
    }

    if (!response.body) {
      throw new Error('Ollama returned empty body');
    }

    let fullText = '';
    const reader = response.body.getReader?.();
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) fullText += parsed.response;
          } catch {
            // ignore
          }
        }
      }
    } else {
      const data = (await response.json()) as { response?: string };
      fullText = data.response || 'No response generated.';
    }

    return fullText || 'No response generated.';
  }
}

export const aiService = new AIService();

