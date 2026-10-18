import { logger } from './logger';
import { settingsStore } from './settings';
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

export class AIService {
  async analyzeLogs(sender: Electron.WebContents, logs: string, prompt: string): Promise<string> {
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
    sender: Electron.WebContents,
    configuredBaseUrl: string,
    configuredModel: string,
    logs: string,
    prompt: string
  ): Promise<string> {
    let baseUrl = configuredBaseUrl || 'http://127.0.0.1:11434';
    const model = configuredModel || 'qwen2.5:7b';

    // Force 127.0.0.1 instead of localhost to prevent IPv6 resolution issues
    baseUrl = baseUrl.replace('http://localhost', 'http://127.0.0.1');

    const url = `${baseUrl}/api/generate`;
    // Truncate logs to reduce prompt eval time (15K chars ≈ 5K tokens) with disclosure
    let truncatedLogs = logs;
    let disclosure = '';
    if (logs.length > 15000) {
      truncatedLogs = logs.substring(logs.length - 15000);
      disclosure = '\n[NOTICE: Log stream truncated to most recent 15,000 characters for context budget]\n';
    }
    
    // For qwen3 models, prepend /no_think to skip internal chain-of-thought
    const isThinkingModel = model.toLowerCase().startsWith('qwen3');
    const advisoryHeader = 'Advisory role: Provide insights grounded strictly in the logs and finding evidence below. Do not attempt to reclassify severity or close issues.\n';
    const finalPrompt = isThinkingModel
      ? `/no_think\n${advisoryHeader}${prompt}${disclosure}\n\nLogs:\n${truncatedLogs}`
      : `${advisoryHeader}${prompt}${disclosure}\n\nLogs:\n${truncatedLogs}`;

    const payload = {
      model: model,
      prompt: finalPrompt,
      stream: true
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      if (err.name === 'TimeoutError') {
         throw new Error(`Connection to Ollama at ${baseUrl} timed out after 15s. Is the IP correct and firewall open?`, { cause: e });
      }
      if (err.message?.includes('fetch failed') || err.code === 'ECONNREFUSED') {
        if (baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost')) {
          // Attempt to start local Ollama daemon
          try {
            sender.send('ai:progress', `Starting local Ollama daemon...`);
            exec('ollama serve');
            await new Promise(r => setTimeout(r, 3000));
            // Retry fetch
            response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(15000)
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
        // Auto pull model
        sender.send('ai:progress', `Model "${model}" not found locally. Downloading automatically (this may take a few minutes depending on your internet speed)...`);
        
        try {
          const pullRes = await fetch(`${baseUrl}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model })
          });
          
          if (!pullRes.ok) throw new Error("Pull failed: " + await pullRes.text());
          
          // Stream pull progress to UI
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
                    sender.send('ai:progress', progressText);
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
          
          sender.send('ai:progress', `Download complete! Starting analysis...`);
          // Retry the actual analysis request
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
            throw new Error(`Analysis failed after pulling model. Error: ${await response.text()}`);
          }
        } catch (pullError: unknown) {
          throw new Error(`Failed to automatically download model "${model}". Error: ${(pullError as Error).message}`, { cause: pullError });
        }
      } else {
        // errText extraction replaced because it had empty block
        throw new Error(`Ollama API Error (${status})`);
      }
    }

    if (!response.body) {
      throw new Error('Ollama returned empty body');
    }

    let fullText = '';
    // Node.js 18 fetch body supports async iteration or getReader
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
      // Fallback if reader isn't available (e.g. older Electron fetch impl)
      const data = (await response.json()) as { response?: string };
      fullText = data.response || 'No response generated.';
    }

    return fullText || 'No response generated.';
  }
}

export const aiService = new AIService();
