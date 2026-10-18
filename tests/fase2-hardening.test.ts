import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveTarget, validateToolsForTarget } from '../electron/services/target/targetValidator';
import { RequestWorkspace } from '../electron/services/workspace/requestWorkspace';
import { authService, AuthSessionError } from '../electron/services/workspace/authService';
import { ScopeEnforcer, BudgetTracker, type EngagementScope } from '../electron/services/workspace/scopeEnforcement';
import { ProvenanceTracker, type InputProvenance } from '../electron/services/workspace/provenance';
import { ScannerAdapters } from '../electron/services/scanners/registry';

test('Fase 2: Typed Target Union & Capability-Based Validation', async (t) => {
  await t.test('resolves web_url, local_source, and container_image accurately', () => {
    const webTarget = resolveTarget('https://api.example.com/v1/users');
    assert.equal(webTarget.type, 'web_url');
    assert.equal((webTarget as any).url, 'https://api.example.com/v1/users');

    const localTarget = resolveTarget(process.cwd());
    assert.equal(localTarget.type, 'local_source');
    assert.equal((localTarget as any).path, process.cwd());

    const containerTarget = resolveTarget('docker:secops/scanner:latest');
    assert.equal(containerTarget.type, 'container_image');
    assert.equal((containerTarget as any).imageReference, 'secops/scanner:latest');
  });

  await t.test('URL ditolak untuk tool source-only (e.g. Semgrep)', () => {
    const webTarget = resolveTarget('https://example.com/app');
    const validation = validateToolsForTarget(webTarget, ['semgrep', 'nuclei']);

    assert.equal(validation.valid, false);
    assert.equal(validation.rejectedTools.length, 1);
    assert.equal(validation.rejectedTools[0].tool, 'semgrep');
    assert.match(validation.rejectedTools[0].reason, /requires a local source repository.*cannot run against web URL/i);
  });

  await t.test('Semgrep adapter rejects remote URL and never scans outDir', () => {
    const semgrep = ScannerAdapters.semgrep;
    const dummyContext: any = {
      targetUrl: 'https://remote-target.com/web',
      outDir: path.join(os.tmpdir(), 'reports_out_dir'),
      jsonFile: path.join(os.tmpdir(), 'semgrep.json')
    };

    assert.throws(
      () => semgrep.getCommandArgs(dummyContext),
      /Semgrep requires a local source directory and cannot scan remote web URLs/
    );
  });

  await t.test('Local source directory is accepted for source tools and container image for Trivy', () => {
    const localTarget = resolveTarget(process.cwd());
    const sastVal = validateToolsForTarget(localTarget, ['semgrep', 'gitleaks', 'trivy']);
    assert.equal(sastVal.valid, true);

    const containerTarget = resolveTarget('docker:alpine:latest');
    const containerVal = validateToolsForTarget(containerTarget, ['trivy']);
    assert.equal(containerVal.valid, true);
  });
});

test('Fase 2: Request Workspace, Importers & Safe Redacted Arguments', async (t) => {
  await t.test('imports raw RFC 7230 HTTP POST request with JSON body', () => {
    const rawHttp = [
      'POST /api/v2/auth/login HTTP/1.1',
      'Host: api.target.local:8443',
      'Content-Type: application/json',
      'Authorization: Bearer test-secret-token-12345',
      'Cookie: session_id=sess_abc987; tracker=active',
      '',
      '{"username":"admin","password":"password123","remember":true}'
    ].join('\r\n');

    const req = RequestWorkspace.importRawHttp(rawHttp);
    assert.equal(req.method, 'POST');
    assert.equal(req.url, 'https://api.target.local:8443/api/v2/auth/login');
    assert.equal(req.contentType, 'application/json');
    assert.equal(req.cookies['session_id'], 'sess_abc987');
    assert.ok(req.testParameters.includes('username'));
    assert.ok(req.testParameters.includes('password'));
  });

  await t.test('imports raw HTTP form-urlencoded request with query params', () => {
    const rawHttp = [
      'POST /search?category=books&sort=desc HTTP/1.1',
      'Host: store.example.com',
      'Content-Type: application/x-www-form-urlencoded',
      '',
      'q=security+guide&limit=50'
    ].join('\n');

    const req = RequestWorkspace.importRawHttp(rawHttp);
    assert.equal(req.method, 'POST');
    assert.equal(req.query['category'], 'books');
    assert.equal(req.query['sort'], 'desc');
    assert.ok(req.testParameters.includes('category'));
    assert.ok(req.testParameters.includes('q'));
  });

  await t.test('inspectParameters correctly identifies parameter locations', () => {
    const rawHttp = [
      'POST /checkout?coupon=DISCOUNT HTTP/1.1',
      'Host: store.example.com',
      'Content-Type: application/json',
      'Cookie: cart_id=cart_445566',
      'X-Tracking-ID: track_999',
      '',
      '{"items":[{"id":101}],"total":99.50}'
    ].join('\n');

    const req = RequestWorkspace.importRawHttp(rawHttp);
    const locations = RequestWorkspace.inspectParameters(req);

    assert.ok(locations.some(l => l.name === 'coupon' && l.location === 'query'));
    assert.ok(locations.some(l => l.name === 'cart_id' && l.location === 'cookie'));
    assert.ok(locations.some(l => l.name === 'total' && l.location === 'body'));
    assert.ok(locations.some(l => l.name === 'x-tracking-id' && l.location === 'header'));
  });

  await t.test('buildToolArguments generates correct CLI arguments for POST JSON/form', () => {
    const rawHttp = [
      'POST /api/v1/transfer HTTP/1.1',
      'Host: bank.local',
      'Content-Type: application/json',
      'Cookie: auth_sid=sid_secret_1122',
      '',
      '{"account":"ACC-1002","amount":500}'
    ].join('\n');

    const req = RequestWorkspace.importRawHttp(rawHttp);
    req.testParameters = ['account'];

    // SQLmap
    const sqlmapArgs = RequestWorkspace.buildToolArguments('sqlmap', req, 'Bearer top-secret-jwt-xyz');
    assert.ok(sqlmapArgs.includes('-u'));
    assert.ok(sqlmapArgs.includes('--batch'));
    assert.ok(sqlmapArgs.includes('--method=POST'));
    assert.ok(sqlmapArgs.some(a => a.startsWith('--data=') && a.includes('ACC-1002')));
    assert.ok(sqlmapArgs.includes('-p'));
    assert.ok(sqlmapArgs.includes('account'));
    assert.ok(sqlmapArgs.some(a => a.startsWith('--cookie=') && a.includes('sid_secret_1122')));
    assert.ok(sqlmapArgs.some(a => a.includes('Authorization: Bearer top-secret-jwt-xyz')));

    // Commix
    const commixArgs = RequestWorkspace.buildToolArguments('commix', req);
    assert.ok(commixArgs.includes('--url'));
    assert.ok(commixArgs.some(a => a.startsWith('--data=')));
    assert.ok(commixArgs.includes('-p'));
    assert.ok(commixArgs.includes('account'));

    // Safe Preview: Secrets must be strictly redacted!
    const preview = RequestWorkspace.buildSafePreview('sqlmap', req, 'Bearer top-secret-jwt-xyz');
    assert.ok(!preview.some(a => a.includes('top-secret-jwt-xyz')), 'Secret JWT must not be present in preview');
    assert.ok(!preview.some(a => a.includes('sid_secret_1122')), 'Session cookie must not be present in preview');
    assert.ok(preview.some(a => a.includes('[AUTH_REDACTED]')), 'Must include [AUTH_REDACTED] marker');
    assert.ok(preview.some(a => a.includes('[COOKIES_REDACTED]')), 'Must include [COOKIES_REDACTED] marker');
  });

  await t.test('enforces 10MB safety boundary on raw HTTP import', () => {
    const hugeBuffer = Buffer.alloc(11 * 1024 * 1024, 'A');
    assert.throws(
      () => RequestWorkspace.importRawHttp(`POST /upload HTTP/1.1\nHost: example.com\n\n${hugeBuffer.toString('ascii')}`),
      /exceeds maximum allowed size of 10MB/
    );
  });
});

test('Fase 2: Auth Profiles, Secure Vault & Fail-Closed Session Health', async (t) => {
  await t.test('stores secrets in vault and masks them in public profiles', () => {
    const secret = 'super-secret-api-token-998877';
    const profile = authService.createProfile({
      name: 'Staging Admin Token',
      type: 'bearer',
      rawSecret: secret,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    assert.ok(profile.id.startsWith('auth_'));
    assert.ok(profile.secretRef.startsWith('vault://auth/'));

    const publicProfile = authService.getPublicProfile(profile);
    assert.equal((publicProfile as any).secretRef, undefined);
    assert.equal(publicProfile.hasSecret, true);
    assert.equal(publicProfile.maskedToken.includes('super-secret'), false);
  });

  await t.test('aborts with AUTH_EXPIRED when session token has expired', async () => {
    const expiredProfile = authService.createProfile({
      name: 'Old Session Token',
      type: 'bearer',
      rawSecret: 'expired-token-val',
      expiresAt: new Date(Date.now() - 60000).toISOString() // 1 minute in the past
    });

    assert.equal(authService.isSessionExpired(expiredProfile), true);

    await assert.rejects(
      async () => authService.validateSessionForLaunch(expiredProfile),
      (err: unknown) => {
        assert.ok(err instanceof AuthSessionError);
        assert.equal(err.code, 'AUTH_EXPIRED');
        assert.match(err.message, /expired at/i);
        return true;
      }
    );
  });

  await t.test('aborts with AUTH_INVALID when remote session health check fails (401)', async () => {
    // Probe a non-existent or failing port/service to simulate unauthorized
    const profileWithHealth = authService.createProfile({
      name: 'Corporate Auth Profile',
      type: 'bearer',
      rawSecret: 'test-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      sessionHealthCheck: {
        endpointUrl: 'http://127.0.0.1:9999/health-probe-unreachable',
        expectedStatus: 200,
        timeoutMs: 100
      }
    });

    await assert.rejects(
      async () => authService.validateSessionForLaunch(profileWithHealth),
      (err: unknown) => {
        assert.ok(err instanceof AuthSessionError);
        assert.equal(err.code, 'AUTH_INVALID');
        assert.match(err.message, /Session health check failed/i);
        return true;
      }
    );
  });

  await t.test('resolves valid bearer token header when session is healthy and active', async () => {
    const validProfile = authService.createProfile({
      name: 'Valid Active Session',
      type: 'bearer',
      rawSecret: 'valid-token-alpha-123',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    const launchAuth = await authService.validateSessionForLaunch(validProfile);
    assert.equal(launchAuth.valid, true);
    assert.equal(launchAuth.resolvedHeader, 'Bearer valid-token-alpha-123');
  });
});

test('Fase 2: Engagement Scope, Allowlist & Budget Enforcement', async (t) => {
  const scope: EngagementScope = {
    id: 'eng_prod_01',
    name: 'Production Assessment Scope',
    targetCanonical: 'https://app.target.com',
    allowlistDomains: ['app.target.com', '*.api.target.com'],
    allowlistPrefixes: ['https://app.target.com/portal/', 'https://v1.api.target.com/'],
    excludedPaths: ['/portal/logout', '/portal/delete-account', '/portal/admin/reset'],
    excludedQueryParams: ['logout', 'action=destroy'],
    budget: {
      maxTotalRequests: 10,
      maxDurationMinutes: 5
    }
  };

  await t.test('permits in-scope allowlisted domain and matching path', () => {
    const res1 = ScopeEnforcer.isUrlInScope('https://app.target.com/portal/dashboard', scope);
    assert.equal(res1.inScope, true);

    const res2 = ScopeEnforcer.isUrlInScope('https://v1.api.target.com/users', scope);
    assert.equal(res2.inScope, true);
  });

  await t.test('strictly blocks out-of-scope domains', () => {
    const res = ScopeEnforcer.isUrlInScope('https://malicious-third-party.com/exploit', scope);
    assert.equal(res.inScope, false);
    assert.match(res.reason || '', /not in allowed domains/i);
  });

  await t.test('strictly blocks excluded paths (e.g. /logout) to prevent session disruption', () => {
    const res = ScopeEnforcer.isUrlInScope('https://app.target.com/portal/logout', scope);
    assert.equal(res.inScope, false);
    assert.match(res.reason || '', /matches excluded path/i);

    const resSub = ScopeEnforcer.isUrlInScope('https://app.target.com/portal/delete-account/confirm', scope);
    assert.equal(resSub.inScope, false);
    assert.match(resSub.reason || '', /matches excluded path/i);
  });

  await t.test('strictly blocks excluded query parameters', () => {
    const res = ScopeEnforcer.isUrlInScope('https://app.target.com/portal/settings?logout=1', scope);
    assert.equal(res.inScope, false);
    assert.match(res.reason || '', /matches excluded query parameter/i);
  });

  await t.test('validates HTTP redirects and blocks external redirect hops', () => {
    const allowed = ScopeEnforcer.validateRedirect('https://app.target.com/portal/home', 'https://app.target.com/portal/dashboard', scope);
    assert.equal(allowed.allowed, true);

    const blocked = ScopeEnforcer.validateRedirect('https://app.target.com/portal/home', 'https://accounts.google.com/o/oauth2/auth', scope);
    assert.equal(blocked.allowed, false);
    assert.match(blocked.reason || '', /Redirect.*to out-of-scope/i);
  });

  await t.test('filters discovery batches to drop out-of-scope URLs', () => {
    const urls = [
      'https://app.target.com/portal/profile',
      'https://external-cdn.com/script.js',
      'https://app.target.com/portal/logout',
      'https://v1.api.target.com/v1/reports'
    ];

    const result = ScopeEnforcer.filterDiscoveryBatch(urls, scope);
    assert.equal(result.inScope.length, 2);
    assert.ok(result.inScope.includes('https://app.target.com/portal/profile'));
    assert.ok(result.inScope.includes('https://v1.api.target.com/v1/reports'));
    assert.equal(result.outOfScope.length, 2);
  });

  await t.test('BudgetTracker stops requests when maxTotalRequests limit is exceeded', () => {
    const tracker = new BudgetTracker({ maxTotalRequests: 5 });
    for (let i = 0; i < 5; i++) {
      assert.equal(tracker.recordRequest().permitted, true);
    }
    const breach = tracker.recordRequest();
    assert.equal(breach.permitted, false);
    assert.match(breach.reason || '', /Request budget exceeded/i);
  });
});

test('Fase 2: Dataflow & Finding Provenance Traceability', async (t) => {
  await t.test('attaches and traces end-to-end finding provenance', () => {
    const provenance: InputProvenance = {
      sourceScanId: 'scan_rec_20261018_alpha',
      endpointId: 42,
      discoveredByTools: ['katana', 'arjun'],
      requestMethod: 'POST',
      requestUrl: 'https://api.target.local/transfer',
      parameterTested: 'account_id',
      scannerEngine: 'sqlmap',
      timestamp: new Date().toISOString()
    };

    const rawFinding = {
      id: 'sqlmap-sqli-42',
      name: 'SQL Injection: account_id',
      severity: 'high',
      scanner: 'sqlmap',
      url: 'https://api.target.local/transfer'
    };

    const findingWithProv = ProvenanceTracker.attachFindingProvenance(rawFinding, provenance);
    assert.ok((findingWithProv as any).evidence?.provenance);

    const traced = ProvenanceTracker.traceFindingProvenance(findingWithProv);
    assert.ok(traced);
    assert.equal(traced?.sourceScanId, 'scan_rec_20261018_alpha');
    assert.equal(traced?.endpointId, 42);
    assert.deepEqual(traced?.discoveredByTools, ['katana', 'arjun']);
    assert.equal(traced?.requestMethod, 'POST');
    assert.equal(traced?.parameterTested, 'account_id');
    assert.equal(traced?.scannerEngine, 'sqlmap');
  });
});
