import { logger } from './logger';
import { settingsStore } from './settings';
import { exec } from 'child_process';
import { promisify } from 'util';
import type * as Electron from 'electron';

export class AIService {
  async analyzeLogs(sender: Electron.WebContents, logs: string, prompt: string): Promise<string> {
    const settings = settingsStore.get();
    const provider = settings.aiProvider;
    const apiKey = settings.aiApiKey;

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
        return await this.callOllama(sender, apiKey, logs, prompt);
      } else {
        throw new Error('Unknown AI Provider');
      }
    } catch (err: any) {
      logger.error(`AI Analysis failed: ${err.message}`, err);
      throw new Error(`AI Analysis failed: ${err.message}`);
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

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
  }

  private async callOpenAI(apiKey: string, logs: string, prompt: string): Promise<string> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a cybersecurity expert.' },
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

    const data = await response.json();
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

    const data = await response.json();
    return data.content?.[0]?.text || 'No response generated.';
  }

  private async callOllama(sender: Electron.WebContents, apiKey: string, logs: string, prompt: string): Promise<string> {
    // Treat API Key as "url,model" or just "model" or leave empty for defaults
    let baseUrl = 'http://127.0.0.1:11434';
    let model = 'qwen2.5:7b'; // Default Ollama model
    
    if (apiKey) {
      if (apiKey.includes(',')) {
        const parts = apiKey.split(',');
        baseUrl = parts[0].trim() || baseUrl;
        model = parts[1].trim() || model;
      } else if (apiKey.startsWith('http')) {
        baseUrl = apiKey.trim();
      } else {
        model = apiKey.trim();
      }
    }

    // Force 127.0.0.1 instead of localhost to prevent IPv6 resolution issues
    baseUrl = baseUrl.replace('http://localhost', 'http://127.0.0.1');

    const url = `${baseUrl}/api/generate`;
    // Truncate logs to reduce prompt eval time (15K chars ≈ 5K tokens)
    const truncatedLogs = logs.length > 15000 ? logs.substring(logs.length - 15000) : logs;
    
    // For qwen3 models, prepend /no_think to skip internal chain-of-thought (saves ~60-90s)
    const isThinkingModel = model.toLowerCase().startsWith('qwen3');
    const finalPrompt = isThinkingModel
      ? `/no_think\n${prompt}\n\nLogs:\n${truncatedLogs}`
      : `${prompt}\n\nLogs:\n${truncatedLogs}`;

    const payload = {
      model: model,
      prompt: finalPrompt,
      stream: true // Enable streaming to prevent socket timeouts
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
    } catch (e: any) {
      if (e.name === 'TimeoutError') {
         throw new Error(`Connection to Ollama at ${baseUrl} timed out after 15s. Is the IP correct and firewall open?`);
      }
      if (e.message?.includes('fetch failed') || e.code === 'ECONNREFUSED') {
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
          } catch (startErr) {
            throw new Error(`Ollama is not running locally and could not be started. Please install it from https://ollama.com`);
          }
        } else {
          throw new Error(`Could not connect to Ollama at ${baseUrl}. (Internal: ${e.message || e.code})`);
        }
      } else {
        throw new Error(`Ollama Request Failed: ${e.message || e.code || e}`);
      }
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 500;
      let errText = '';
      try { errText = await response?.text() || ''; } catch {}
      
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
                } catch (e) {}
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
        } catch (pullError: any) {
          throw new Error(`Failed to automatically download model "${model}". Error: ${pullError.message}`);
        }
      } else {
        throw new Error(`Ollama API Error (${status}): ${errText}`);
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
          } catch (e) {}
        }
      }
    } else {
      // Fallback if reader isn't available (e.g. older Electron fetch impl)
      const data = await response.json();
      fullText = data.response || 'No response generated.';
    }

    return fullText || 'No response generated.';
  }
}

export const aiService = new AIService();
