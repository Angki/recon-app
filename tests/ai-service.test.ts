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

test('AI_PRESETS provides the 4 required cybersecurity analysis presets', () => {
  const { AI_PRESETS } = require('../electron/services/aiService');
  assert.ok(AI_PRESETS.executive.includes('Executive Summary'));
  assert.ok(AI_PRESETS.attack_path.includes('Adversary Simulation'));
  assert.ok(AI_PRESETS.remediation.includes('technical remediation instructions'));
  assert.ok(AI_PRESETS.verification.includes('manual verification commands'));
});

test('testConnection checks connection status and reports latency', async () => {
  const result = await aiService.testConnection('ollama');
  assert.equal(typeof result.success, 'boolean');
  assert.equal(typeof result.latencyMs, 'number');
  assert.equal(typeof result.message, 'string');
});

