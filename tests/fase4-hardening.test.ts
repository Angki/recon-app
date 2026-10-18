import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSstimap, parseJwtTool, activeAdapters, activeRuntime, validateActiveConfig } from '../electron/services/scanners/activeValidation';
import { parseSyft, parseInteractsh, ScannerAdapters } from '../electron/services/scanners/registry';
import { RequestWorkspace } from '../electron/services/workspace/requestWorkspace';
import type { ScannerContext } from '../electron/services/scanners/types';
import type { RequestDefinition } from '../electron/services/workspace/types';

const targetUrl = 'http://127.0.0.1:5000/search?q=test&lang=en';
const activePlan = { scopeOrigin: 'http://127.0.0.1:5000', parameters: ['q'], timeoutMinutes: 5, delaySeconds: 1 };

test('SSTImap parser extracts engine, arithmetic proof, parameter, and confirms high severity', () => {
  const positiveOutput = `
[+] SSTImap v1.2.2 - Automatic SSTI detection and exploitation tool
[*] Scanning URL: http://127.0.0.1:5000/search?q=test&lang=en
[*] Testing parameter 'q'...
[+] Jinja2 (Python) template engine identified!
[+] Verification passed: 7*7 = 49
[+] Injection point found in GET parameter 'q':
    Engine: Jinja2
    Technique: blind / rendered
    Payload: {{7*7}}
`;

  const findings = parseSstimap(positiveOutput, { targetUrl });
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.scanner, 'sstimap');
  assert.equal(f.severity, 'high');
  assert.equal(f.confidence, 'tool-confirmed');
  assert.equal(f.cwe, 'CWE-1336');
  assert.equal(f.parameter, 'q');
  assert.match(f.name as string, /Jinja2/);
  assert.match(f.description as string, /Arithmetic proof verified/);
  assert.deepEqual(f.evidence, {
    engine: 'Jinja2',
    parameter: 'q',
    payload: '{{7*7}}',
    method: 'GET',
    verification: '7*7=49'
  });
});

test('SSTImap parser distinguishes clean negative, empty output, and error conditions', () => {
  const negativeOutput = `
[+] SSTImap v1.2.2 - Automatic SSTI detection and exploitation tool
[*] Scanning URL: http://127.0.0.1:5000/search?q=test&lang=en
[*] Testing parameter 'q'...
[-] SSTImap did not identify any template injection.
`;
  assert.deepEqual(parseSstimap(negativeOutput, { targetUrl }), []);

  assert.throws(() => parseSstimap('', { targetUrl }), /empty output/);
  assert.throws(() => parseSstimap('[CRITICAL] Target host unreachable: connection refused', { targetUrl }), /execution error/);
});

test('SSTImap adapter uses non-destructive verification without shell or exfiltration flags', () => {
  const ctx = {
    scannerName: 'sstimap',
    targetUrl,
    outDir: 'D:\\temp\\scan1',
    outputFile: 'D:\\temp\\scan1\\sstimap.txt',
    jsonFile: 'D:\\temp\\scan1\\sstimap.json',
    config: { activeValidation: activePlan },
    settings: { activePythonPath: process.execPath, sstimapScriptPath: 'D:\\tools\\sstimap.py' }
  } as unknown as ScannerContext;

  const args = activeAdapters.sstimap.getCommandArgs(ctx);
  assert.ok(args.includes('-u'));
  assert.ok(args.includes(targetUrl));
  assert.ok(args.includes('-p'));
  assert.ok(args.includes('q'));
  assert.ok(args.includes('--verify'));
  assert.ok(args.includes('--batch'));
  assert.ok(args.includes('--engine-detection'));
  assert.ok(!args.some(a => /--os-shell|--os-cmd|--eval-shell|--bind-shell|--reverse-shell|--upload|--download/.test(a)));
  assert.ok(activeAdapters.sstimap.isSuccessExitCode!(0, ctx));
  assert.ok(activeAdapters.sstimap.isSuccessExitCode!(1, ctx));
});

test('jwt_tool parser detects server-verified vulnerabilities with strict secret redaction', () => {
  const rawToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.';
  const output = `
====================================================================
jwt_tool v2.2.8 - JSON Web Token analysis toolkit
====================================================================
[*] Target URL: http://127.0.0.1:5000/api/user
[*] Token: ${rawToken}
[*] Testing algorithm none bypass...
[!] VULNERABILITY DETECTED: Algorithm 'none' accepted by server
[*] HTTP 200 OK received with forged signature
`;

  const findings = parseJwtTool(output, { targetUrl });
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.scanner, 'jwt_tool');
  assert.equal(f.severity, 'high');
  assert.equal(f.confidence, 'tool-confirmed');
  assert.equal(f.cwe, 'CWE-347');
  assert.match(f.name as string, /Algorithm 'none' accepted by server/);
  // Verify token secret is strictly redacted from evidence and description
  assert.ok(!JSON.stringify(f).includes(rawToken));
  assert.match(JSON.stringify(f.evidence), /\[REDACTED_TOKEN\]/);
});

test('jwt_tool parser distinguishes offline audit findings from clean validation', () => {
  const offlineAudit = `
[*] Inspecting token structure:
[*] Header: {"alg": "HS256", "typ": "JWT"}
[*] Payload: {"user": "analyst"}
[!] AUDIT FINDING: Missing 'exp' claim (No token expiration set)
[!] AUDIT FINDING: Weak secret key detected in dictionary search
`;
  const findings = parseJwtTool(offlineAudit, { targetUrl });
  assert.equal(findings.length, 2);
  assert.equal(findings[0].severity, 'medium');
  assert.equal(findings[0].confidence, 'offline-analyzed');
  assert.equal(findings[1].severity, 'medium');
  assert.equal(findings[1].confidence, 'offline-analyzed');

  const cleanOutput = `
[*] jwt_tool v2.2.8
[*] Decoded Header: {"alg": "RS256"}
[*] Decoded Payload: {"sub": "123", "exp": 1999999999}
[*] Signature verified
[*] All validation checks passed cleanly.
`;
  assert.deepEqual(parseJwtTool(cleanOutput, { targetUrl }), []);
  assert.throws(() => parseJwtTool('', { targetUrl }), /empty output/);
  assert.throws(() => parseJwtTool('[FATAL] Network error connecting to host', { targetUrl }), /execution error/);
});

test('Syft parser parses SBOM JSON with package purl, licenses, locations, and handles empty/malformed artifacts', () => {
  const validSbom = JSON.stringify({
    artifacts: [
      {
        name: 'express',
        version: '4.19.2',
        type: 'npm',
        purl: 'pkg:npm/express@4.19.2',
        licenses: ['MIT'],
        locations: [{ path: 'package-lock.json' }]
      },
      {
        name: 'cryptography',
        version: '42.0.5',
        type: 'python',
        purl: 'pkg:pypi/cryptography@42.0.5',
        licenses: ['Apache-2.0', 'BSD-3-Clause'],
        locations: [{ path: 'requirements.txt' }]
      }
    ],
    source: {
      type: 'directory',
      target: 'D:\\Projects\\recon-app'
    }
  });

  const findings = parseSyft(validSbom, { targetUrl: 'D:\\Projects\\recon-app' });
  assert.equal(findings.length, 2);
  assert.equal(findings[0].scanner, 'syft');
  assert.equal(findings[0].severity, 'info');
  assert.equal(findings[0].confidence, 'tool-confirmed');
  assert.equal(findings[0].cwe, 'CWE-1395');
  assert.equal((findings[0].evidence as any).purl, 'pkg:npm/express@4.19.2');
  assert.deepEqual((findings[0].evidence as any).licenses, ['MIT']);

  assert.equal((findings[1].evidence as any).purl, 'pkg:pypi/cryptography@42.0.5');
  assert.deepEqual((findings[1].evidence as any).licenses, ['Apache-2.0', 'BSD-3-Clause']);

  // Valid empty SBOM returns []
  assert.deepEqual(parseSyft(JSON.stringify({ artifacts: [] }), { targetUrl: 'D:\\empty' }), []);

  // Malformed JSON must throw error (never swallowed as clean result)
  assert.throws(() => parseSyft('{ artifacts: [ invalid json', { targetUrl: 'D:\\invalid' }), /Failed to parse Syft JSON/);
  assert.throws(() => parseSyft(JSON.stringify({ status: 'ok' }), { targetUrl: 'D:\\invalid' }), /missing artifacts array/);
});

test('Syft adapter formats directory and container targets correctly with exit code semantics', () => {
  const dirCtx = {
    scannerName: 'syft',
    targetUrl: 'D:\\Projects\\target-repo',
    jsonFile: 'D:\\temp\\scan1\\syft.json'
  } as ScannerContext;

  const dirArgs = ScannerAdapters.syft.getCommandArgs(dirCtx);
  assert.ok(dirArgs.includes('dir:D:\\Projects\\target-repo'));
  assert.ok(dirArgs.includes('-o'));
  assert.ok(dirArgs.includes('json=D:\\temp\\scan1\\syft.json'));
  assert.ok(ScannerAdapters.syft.isSuccessExitCode!(0, dirCtx));
  assert.equal(ScannerAdapters.syft.isSuccessExitCode!(1, dirCtx), false);

  const containerCtx = {
    scannerName: 'syft',
    targetUrl: 'alpine:latest',
    jsonFile: 'D:\\temp\\scan1\\syft.json'
  } as ScannerContext;
  const containerArgs = ScannerAdapters.syft.getCommandArgs(containerCtx);
  assert.ok(containerArgs.includes('alpine:latest'));
});

test('Interactsh parser correlates OOB interactions and strictly redacts client IPs and auth headers', () => {
  const jsonLines = `
{"protocol":"dns","unique-id":"cid123","full-id":"cid123.interact.sh","raw-request":"DNS Query for A record","remote-address":"198.51.100.42","timestamp":"2026-10-18T12:00:00Z"}
{"protocol":"http","unique-id":"cid123","full-id":"cid123.interact.sh","raw-request":"GET / HTTP/1.1\\r\\nHost: cid123.interact.sh\\r\\nAuthorization: Bearer supersecrettoken\\r\\nCookie: session=secretcookie\\r\\n\\r\\n","remote-address":"198.51.100.42","timestamp":"2026-10-18T12:00:05Z"}
`;

  const findings = parseInteractsh(jsonLines, { targetUrl });
  assert.equal(findings.length, 2);

  // DNS interaction
  assert.equal(findings[0].scanner, 'interactsh');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].confidence, 'tool-confirmed');
  assert.equal(findings[0].cwe, 'CWE-918');
  assert.equal((findings[0].evidence as any).protocol, 'DNS');
  assert.equal((findings[0].evidence as any).remoteAddress, '[REDACTED_IP]');
  assert.ok(!JSON.stringify(findings[0]).includes('198.51.100.42'));

  // HTTP interaction with redacted request
  assert.equal((findings[1].evidence as any).protocol, 'HTTP');
  assert.equal((findings[1].evidence as any).remoteAddress, '[REDACTED_IP]');
  const rawReqSnippet = (findings[1].evidence as any).rawRequestSnippet;
  assert.ok(rawReqSnippet.includes('Authorization: [REDACTED]'));
  assert.ok(rawReqSnippet.includes('Cookie: [REDACTED]'));
  assert.ok(!rawReqSnippet.includes('supersecrettoken'));
  assert.ok(!rawReqSnippet.includes('secretcookie'));

  // Valid empty output returns []
  assert.deepEqual(parseInteractsh('', { targetUrl }), []);

  // Malformed JSON lines throw error
  assert.throws(() => parseInteractsh('{"protocol": broken', { targetUrl }), /Malformed Interactsh JSON/);
});

test('Interactsh adapter formats session correlation and server flags with exit code semantics', () => {
  const ctx = {
    scannerName: 'interactsh',
    targetUrl,
    scanId: 'scan-uuid-456',
    jsonFile: 'D:\\temp\\scan1\\interactsh.json',
    settings: {
      interactshServer: 'https://oob.internal.company.com',
      interactshToken: 'token-xyz-123'
    },
    config: {
      correlationId: 'cid-custom-999'
    }
  } as unknown as ScannerContext;

  const args = ScannerAdapters.interactsh.getCommandArgs(ctx);
  assert.ok(args.includes('-json'));
  assert.ok(args.includes('-o'));
  assert.ok(args.includes('D:\\temp\\scan1\\interactsh.json'));
  assert.ok(args.includes('-server'));
  assert.ok(args.includes('https://oob.internal.company.com'));
  assert.ok(args.includes('-token'));
  assert.ok(args.includes('token-xyz-123'));
  assert.ok(args.includes('-sf'));
  assert.ok(args.includes('D:\\temp\\scan1\\interactsh_session.yaml'));
  assert.ok(ScannerAdapters.interactsh.isSuccessExitCode!(0, ctx));
  assert.equal(ScannerAdapters.interactsh.isSuccessExitCode!(1, ctx), false);
});

test('RequestWorkspace argument generation and safe preview secret redaction for active tools', () => {
  const req: RequestDefinition = {
    id: 'req-1',
    name: 'Profile Search',
    method: 'POST',
    url: 'https://api.internal.lab/v1/profile?category=admin',
    headers: { 'Content-Type': 'application/json' },
    cookies: { sessionid: 'sess-abc-789' },
    body: '{"query": "admin"}',
    testParameters: ['category'],
    authProfileId: 'auth-1',
    source: 'manual',
    createdAt: new Date().toISOString()
  };

  const secretAuth = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYWRtaW4ifQ.secret';

  // 1. SSTImap arguments and safe preview
  const sstimapArgs = RequestWorkspace.buildToolArguments('sstimap', req, secretAuth);
  assert.ok(sstimapArgs.includes('-u'));
  assert.ok(sstimapArgs.includes('https://api.internal.lab/v1/profile?category=admin'));
  assert.ok(sstimapArgs.includes('--data={"query": "admin"}'));
  assert.ok(sstimapArgs.includes('-p'));
  assert.ok(sstimapArgs.includes('category'));
  assert.ok(sstimapArgs.includes('--headers=Authorization: ' + secretAuth));

  const sstimapPreview = RequestWorkspace.buildSafePreview('sstimap', req, secretAuth);
  assert.ok(!JSON.stringify(sstimapPreview).includes('secret'));
  assert.ok(sstimapPreview.some(a => a.includes('Authorization: [AUTH_REDACTED]')));
  assert.ok(sstimapPreview.some(a => a.includes('--cookie=[COOKIES_REDACTED]')));

  // 2. jwt_tool arguments and safe preview
  const jwtArgs = RequestWorkspace.buildToolArguments('jwt_tool', req, secretAuth);
  assert.ok(jwtArgs.includes('-t'));
  assert.ok(jwtArgs.includes('-b'));
  assert.ok(jwtArgs.some(a => a.startsWith('eyJhbGciOiJIUzI1Ni')));

  const jwtPreview = RequestWorkspace.buildSafePreview('jwt_tool', req, secretAuth);
  assert.ok(!JSON.stringify(jwtPreview).includes(secretAuth));
  assert.ok(!JSON.stringify(jwtPreview).includes('eyJhbGciOiJIUzI1Ni'));
  assert.ok(jwtPreview.includes('[AUTH_REDACTED]'));

  // 3. Dalfox arguments and safe preview
  const dalfoxArgs = RequestWorkspace.buildToolArguments('dalfox', req, secretAuth);
  assert.ok(dalfoxArgs.includes('url'));
  assert.ok(dalfoxArgs.includes('--data'));
  assert.ok(dalfoxArgs.includes('{"query": "admin"}'));
  assert.ok(dalfoxArgs.includes('-p'));
  assert.ok(dalfoxArgs.includes('category'));

  const dalfoxPreview = RequestWorkspace.buildSafePreview('dalfox', req, secretAuth);
  assert.ok(!JSON.stringify(dalfoxPreview).includes('secret'));
  assert.ok(dalfoxPreview.some(a => a.includes('Authorization: [AUTH_REDACTED]')));
});
