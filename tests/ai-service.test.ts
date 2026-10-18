import test from 'node:test';
import assert from 'node:assert/strict';
import { aiService, isLoopbackHost, processStreamChunks, AI_PRESETS } from '../electron/services/aiService';
import { dbService } from '../electron/services/database';
import { settingsStore } from '../electron/services/settings';

test('isLoopbackHost correctly validates local Ollama hosts', () => {
  assert.equal(isLoopbackHost('http://127.0.0.1:11434'), true);
  assert.equal(isLoopbackHost('http://localhost:11434'), true);
  assert.equal(isLoopbackHost('http://[::1]:11434'), true);
  assert.equal(isLoopbackHost('https://api.external.com'), false);
  assert.equal(isLoopbackHost('http://192.168.1.100:11434'), false);
});

test('processStreamChunks handles fragmented JSON lines across chunk boundaries', () => {
  const emittedLines: string[] = [];
  const onLine = (line: string) => emittedLines.push(line);

  // Chunk 1 has an incomplete line at the end
  let buffer = '';
  buffer = processStreamChunks(buffer, '{"response":"Hello ', onLine);
  assert.equal(emittedLines.length, 0);
  assert.equal(buffer, '{"response":"Hello ');

  // Chunk 2 completes the line and includes a full second line and partial third
  buffer = processStreamChunks(buffer, 'World"}\n{"response":"!"}\n{"res', onLine);
  assert.equal(emittedLines.length, 2);
  assert.equal(emittedLines[0], '{"response":"Hello World"}');
  assert.equal(emittedLines[1], '{"response":"!"}');
  assert.equal(buffer, '{"res');

  // Chunk 3 finishes the third line
  buffer = processStreamChunks(buffer, 'ponse":"Done"}\n', onLine);
  assert.equal(emittedLines.length, 3);
  assert.equal(emittedLines[2], '{"response":"Done"}');
  assert.equal(buffer, '');
});

test('synthesizeFindingsContext sorts findings by severity and displays scan status', () => {
  const scanId = 'test_ai_synth_scan';
  dbService.insertScan(scanId, 'http://test.local', 'FAILED', new Date().toISOString(), {});
  dbService.insertFindings(scanId, 'nuclei', [
    {
      id: 'info-test',
      name: 'Server Banner Disclosed',
      severity: 'info',
      scanner: 'nuclei',
      url: 'http://test.local',
      description: 'Apache 2.4 banner',
      timestamp: new Date().toISOString()
    },
    {
      id: 'cve-2024-test',
      name: 'SQL Injection in /api/v1/user',
      severity: 'critical',
      scanner: 'nuclei',
      url: 'http://test.local/api/v1/user?id=1',
      description: 'Error-based SQL injection detected',
      evidence: "syntax error near unexpected token '",
      timestamp: new Date().toISOString()
    }
  ]);

  const context = aiService.synthesizeFindingsContext(scanId, 'http://test.local');
  assert.ok(context.includes('http://test.local'));
  assert.ok(context.includes('**Scan Status**: FAILED'));
  assert.ok(context.includes('Scan execution status is FAILED'));
  assert.ok(context.includes('**Finding ID**: `cve-2024-test`'));
  assert.ok(context.includes("**Evidence**: `syntax error near unexpected token '`"));

  // Critical finding must appear before info finding in the rendered context
  const criticalIndex = context.indexOf('SQL Injection in /api/v1/user');
  const infoIndex = context.indexOf('Server Banner Disclosed');
  assert.ok(criticalIndex < infoIndex, 'Critical finding should be prioritized before Info finding');

  dbService.deleteScan(scanId);
});

test('AI_PRESETS provides the 4 required cybersecurity analysis presets', () => {
  assert.ok(AI_PRESETS.executive.includes('Executive Summary'));
  assert.ok(AI_PRESETS.attack_path.includes('Adversary Simulation'));
  assert.ok(AI_PRESETS.remediation.includes('technical remediation instructions'));
  assert.ok(AI_PRESETS.verification.includes('manual verification commands'));
});

test('testConnection and getLocalOllamaModels succeed with deterministic mock transport', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // 1. Mock Ollama tags endpoint returning 2 models
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/tags')) {
        return new Response(JSON.stringify({
          models: [
            { name: 'qwen2.5:7b' },
            { name: 'sast-qwen3.5:9b' }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Not found', { status: 404 });
    };

    const modelsRes = await aiService.getLocalOllamaModels('http://127.0.0.1:11434');
    assert.equal(modelsRes.success, true);
    assert.deepEqual(modelsRes.models, ['qwen2.5:7b', 'sast-qwen3.5:9b']);

    const connRes = await aiService.testConnection('ollama', 'http://127.0.0.1:11434');
    assert.equal(connRes.success, true);
    assert.equal(connRes.modelCount, 2);
    assert.ok(connRes.message.includes('2 models available'));

    // 2. Mock Ollama failure (500)
    globalThis.fetch = async () => new Response('Internal error', { status: 500 });
    const failRes = await aiService.testConnection('ollama', 'http://127.0.0.1:11434');
    assert.equal(failRes.success, false);
    assert.ok(failRes.message.includes('HTTP 500'));

    // 3. Mock network offline error
    globalThis.fetch = async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    };
    const offlineRes = await aiService.testConnection('ollama', 'http://127.0.0.1:11434');
    assert.equal(offlineRes.success, false);
    assert.ok(offlineRes.message.includes('Connection failed'));

    // 4. Test Anthropic provider configuration check (requires cloud-allowed or hybrid policy)
    const currentSettings = settingsStore.get();
    settingsStore.save({ aiApiKey: 'test-anthropic-key-configured', aiPolicy: 'cloud-allowed' });
    const anthropicRes = await aiService.testConnection('anthropic');
    assert.equal(anthropicRes.success, true);
    assert.equal(anthropicRes.message, 'Anthropic API key configured');
    settingsStore.save({ aiApiKey: currentSettings.aiApiKey || '', aiPolicy: currentSettings.aiPolicy || 'local-only' });

    // 5. Enforce local-only policy against external endpoint
    const extRes = await aiService.testConnection('ollama', 'https://remote-ai.external.com');
    assert.equal(extRes.success, false);
    assert.ok(extRes.message.includes('local-only'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
