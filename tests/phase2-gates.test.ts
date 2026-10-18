import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateExternalUrl } from '../electron/ipc';
import { settingsStore, MASKED_SENTINEL } from '../electron/services/settings';
import { isLoopbackHost } from '../electron/services/aiService';

test('Gate Phase 2: External URL Protocol Allowlisting & Boundary Enforcement', async (t) => {
  await t.test('permits valid http and https URLs', () => {
    assert.equal(validateExternalUrl('https://example.com/api'), 'https://example.com/api');
    assert.equal(validateExternalUrl('http://127.0.0.1:8080/test'), 'http://127.0.0.1:8080/test');
  });

  await t.test('strictly blocks file:// scheme', () => {
    assert.throws(
      () => validateExternalUrl('file:///C:/Windows/System32/calc.exe'),
      /Invalid protocol 'file:'/
    );
  });

  await t.test('strictly blocks javascript: pseudo-protocol', () => {
    assert.throws(
      () => validateExternalUrl('javascript:alert(document.cookie)'),
      /Invalid protocol 'javascript:'/
    );
  });

  await t.test('strictly blocks arbitrary shell or data protocols', () => {
    assert.throws(
      () => validateExternalUrl('powershell:Invoke-WebRequest'),
      /Invalid protocol 'powershell:'/
    );
    assert.throws(
      () => validateExternalUrl('data:text/html,<script>evil()</script>'),
      /Invalid protocol 'data:'/
    );
  });

  await t.test('rejects empty or non-string inputs', () => {
    assert.throws(() => validateExternalUrl(''), /URL must be a non-empty string/);
    assert.throws(() => validateExternalUrl(null as unknown as string), /URL must be a non-empty string/);
  });
});

test('Gate Phase 2: Secrets Vault, Masked Reads, and Fail-Closed Storage', async (t) => {
  const secretKey = 'sk-super-secret-test-key-12345';
  
  await t.test('saves secret and retrieves masked value via getPublic()', () => {
    settingsStore.save({
      aiApiKey: secretKey,
      acunetixApiKey: 'acunetix-secret-key-999'
    });

    const pub = settingsStore.getPublic();
    assert.equal(pub.aiApiKey, MASKED_SENTINEL, 'Public read must mask aiApiKey');
    assert.equal(pub.acunetixApiKey, MASKED_SENTINEL, 'Public read must mask acunetixApiKey');
    assert.equal(pub.hasAiApiKey, true, 'hasAiApiKey flag must be true');
    assert.equal(pub.hasAcunetixApiKey, true, 'hasAcunetixApiKey flag must be true');

    // Internal get() retains real decrypted secret for engine use
    const internal = settingsStore.get();
    assert.equal(internal.aiApiKey, secretKey, 'Internal engine get() must retain secret');
  });

  await t.test('preserves existing secret when UI returns sentinel without changes', () => {
    // Simulate UI loading public settings and clicking save without re-entering the secret
    settingsStore.save({
      aiApiKey: MASKED_SENTINEL, // UI sent back the masked sentinel
      wordlistPath: 'C:\\wordlists\\common.txt'
    });

    const internal = settingsStore.get();
    assert.equal(internal.aiApiKey, secretKey, 'Secret must not be overwritten by sentinel');
    assert.equal(internal.wordlistPath, 'C:\\wordlists\\common.txt');
  });
});

test('Gate Phase 2: AI Isolation & Local-First Model Enforcement', async (t) => {
  await t.test('identifies loopback endpoints correctly', () => {
    assert.equal(isLoopbackHost('http://127.0.0.1:11434'), true);
    assert.equal(isLoopbackHost('http://localhost:11434'), true);
    assert.equal(isLoopbackHost('http://[::1]:11434'), true);
  });

  await t.test('rejects external/remote endpoints from loopback check', () => {
    assert.equal(isLoopbackHost('https://api.openai.com/v1'), false);
    assert.equal(isLoopbackHost('https://generativelanguage.googleapis.com'), false);
    assert.equal(isLoopbackHost('http://192.168.1.100:11434'), false);
    assert.equal(isLoopbackHost('http://remote-ollama.internal:11434'), false);
  });

  await t.test('default AI settings are local-first with offline model', () => {
    const current = settingsStore.get();
    assert.equal(current.aiProvider, 'ollama');
    assert.equal(current.aiPolicy, 'local-only');
    assert.equal(current.aiModel, 'qwen2.5:7b');
    assert.notEqual(current.aiModel, 'minimax-m3:cloud', 'Cloud model must not be the default');
  });
});

test('Gate Phase 2: Acunetix Hardening & Commercial Credential Safety', async (t) => {
  const runnerScriptPath = path.resolve(__dirname, '../electron/scripts/acunetix_runner.js');
  const runnerContent = fs.readFileSync(runnerScriptPath, 'utf8');

  await t.test('runner script contains NO hardcoded passwords or emails', () => {
    assert.equal(runnerContent.includes('Admin123'), false, 'Hardcoded password Admin123 must be eliminated');
    assert.equal(runnerContent.includes('admin@admin.com'), false, 'Hardcoded email admin@admin.com must be eliminated');
  });

  await t.test('runner script contains NO static developer container IDs', () => {
    assert.equal(runnerContent.includes('4fb15847b3d4f'), false, 'Hardcoded container ID 4fb15847b3d4f must be eliminated');
  });

  await t.test('runner script verifies TLS certificates by default', () => {
    assert.match(runnerContent, /rejectUnauthorized:\s*!allowInsecure/);
  });
});
