import http from 'node:http';
import https from 'node:https';
import { dbService } from '../database';
import { endpointInventory } from '../endpointInventory';
import { logger } from '../logger';

const MAX_BODY_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;

interface PostureResponse {
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  setCookies: string[];
  body: string;
}

interface FormCandidate {
  url: string;
  method: string;
  parameters: string[];
}

function requestOnce(
  url: string,
  headers: Record<string, string>
): Promise<PostureResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(
      parsed,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'SecOps-Recon-Posture/1.0',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          ...headers
        },
        timeout: REQUEST_TIMEOUT_MS
      },
      res => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total <= MAX_BODY_BYTES) chunks.push(chunk);
        });
        res.on('end', () => {
          const rawSetCookie = res.headers['set-cookie'];
          resolve({
            finalUrl: url,
            statusCode: res.statusCode || 0,
            headers: res.headers,
            setCookies: Array.isArray(rawSetCookie) ? rawSetCookie : rawSetCookie ? [rawSetCookie] : [],
            body: Buffer.concat(chunks).toString('utf8')
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('HTTP posture request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchWithSameOriginRedirects(
  url: string,
  headers: Record<string, string>
): Promise<PostureResponse> {
  let current = url;
  const origin = new URL(url).origin;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const response = await requestOnce(current, headers);
    const location = response.headers.location;
    if (response.statusCode < 300 || response.statusCode >= 400 || !location) {
      return response;
    }
    const next = new URL(String(location), current).href;
    if (new URL(next).origin !== origin) {
      return response;
    }
    current = next;
  }
  return requestOnce(current, headers);
}

function headerValue(headers: PostureResponse['headers'], name: string): string {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(', ') : value || '';
}

function extractForms(body: string, baseUrl: string): FormCandidate[] {
  const forms: FormCandidate[] = [];
  const formRegex = /<form\b[^>]*>([\s\S]*?)<\/form>/gi;
  let match: RegExpExecArray | null;
  while ((match = formRegex.exec(body)) !== null) {
    const openTag = match[0].slice(0, match[0].indexOf('>') + 1);
    const actionMatch = openTag.match(/\baction\s*=\s*["']([^"']*)["']/i);
    const methodMatch = openTag.match(/\bmethod\s*=\s*["']([^"']*)["']/i);
    const method = (methodMatch?.[1] || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
    let action = baseUrl;
    if (actionMatch?.[1]) {
      try {
        action = new URL(actionMatch[1], baseUrl).href;
      } catch {
        action = baseUrl;
      }
    }
    const params: string[] = [];
    const inputRegex = /<(?:input|select|textarea)\b[^>]*\bname\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let input: RegExpExecArray | null;
    while ((input = inputRegex.exec(match[1])) !== null) {
      const name = input[1].trim();
      if (name && !name.toLowerCase().startsWith('_')) params.push(name);
    }
    forms.push({ url: action, method, parameters: [...new Set(params)].sort() });
  }
  return forms;
}

function isSessionCookie(name: string): boolean {
  return /session|sessid|phpsessid|laravel|auth|token|jwt|sid|remember/i.test(name);
}

function buildPostureFindings(response: PostureResponse): Record<string, unknown>[] {
  const findings: Record<string, unknown>[] = [];
  const isHttps = new URL(response.finalUrl).protocol === 'https:';
  const csp = headerValue(response.headers, 'content-security-policy');
  const xfo = headerValue(response.headers, 'x-frame-options');
  const hsts = headerValue(response.headers, 'strict-transport-security');
  const xcto = headerValue(response.headers, 'x-content-type-options');
  const referrer = headerValue(response.headers, 'referrer-policy');
  const permissions = headerValue(response.headers, 'permissions-policy');

  const evidence = (extra: Record<string, unknown> = {}) => ({
    type: 'http-response',
    url: response.finalUrl,
    statusCode: response.statusCode,
    headers: {
      server: headerValue(response.headers, 'server') || undefined,
      'content-security-policy': csp || undefined,
      'strict-transport-security': hsts || undefined,
      'x-frame-options': xfo || undefined,
      'x-content-type-options': xcto || undefined,
      'referrer-policy': referrer || undefined,
      'permissions-policy': permissions || undefined
    },
    ...extra
  });

  const add = (id: string, name: string, severity: string, description: string, remediation: string) => {
    findings.push({
      id,
      name,
      severity,
      scanner: 'posture',
      url: response.finalUrl,
      description,
      remediation,
      evidence: evidence(),
      timestamp: new Date().toISOString()
    });
  };

  if (isHttps && !hsts) {
    add(
      'posture-hsts-missing',
      'HTTP Strict Transport Security (HSTS) Header Missing',
      'medium',
      'The HTTPS response does not include a Strict-Transport-Security header. Clients can be downgraded to plaintext HTTP through network attacks or unsafe links.',
      'Send Strict-Transport-Security: max-age=31536000; includeSubDomains (add preload only after verifying all subdomains support HTTPS).'
    );
  }
  if (!csp) {
    add(
      'posture-csp-missing',
      'Content-Security-Policy Header Missing',
      'low',
      'No Content-Security-Policy header was returned. The absence of a CSP removes a key defense-in-depth control against script injection and third-party resource abuse.',
      'Define a restrictive Content-Security-Policy, starting in report-only mode, then enforce script-src with nonces or hashes.'
    );
  }
  if (!xfo && !/frame-ancestors/i.test(csp)) {
    add(
      'posture-x-frame-options-missing',
      'Clickjacking Protection Missing',
      'low',
      'Neither X-Frame-Options nor a CSP frame-ancestors directive is present, allowing the application to be framed by third-party origins.',
      'Set X-Frame-Options: DENY (or SAMEORIGIN) and/or CSP frame-ancestors to restrict embedding.'
    );
  }
  if (!xcto) {
    add(
      'posture-x-content-type-options-missing',
      'X-Content-Type-Options Header Missing',
      'low',
      'The response omits X-Content-Type-Options: nosniff, allowing browsers to MIME-sniff content in some contexts.',
      'Set X-Content-Type-Options: nosniff on all responses.'
    );
  }
  if (!referrer) {
    add(
      'posture-referrer-policy-missing',
      'Referrer-Policy Header Missing',
      'low',
      'No Referrer-Policy header was returned, so sensitive URL paths may leak to third-party origins through the Referer header.',
      'Set Referrer-Policy: strict-origin-when-cross-origin or no-referrer as appropriate.'
    );
  }
  if (!permissions) {
    add(
      'posture-permissions-policy-missing',
      'Permissions-Policy Header Missing',
      'low',
      'No Permissions-Policy header was returned, so powerful browser features are not explicitly restricted.',
      'Set Permissions-Policy to disable features the application does not use (camera, microphone, geolocation, payment, etc.).'
    );
  }

  const cookieFlags = new Map<string, { secure: boolean; httpOnly: boolean; sameSite: boolean; session: boolean }>();
  for (const raw of response.setCookies) {
    const [pair] = raw.split(';');
    const cookieName = pair.split('=')[0]?.trim();
    if (!cookieName) continue;
    const lower = raw.toLowerCase();
    cookieFlags.set(cookieName, {
      secure: /;\s*secure\b/i.test(raw),
      httpOnly: /;\s*httponly\b/i.test(raw),
      sameSite: /;\s*samesite\s*=/i.test(raw),
      session: isSessionCookie(cookieName)
    });
    void lower;
  }

  for (const [cookieName, flags] of cookieFlags.entries()) {
    const severity = flags.session ? 'medium' : 'low';
    const missing: string[] = [];
    if (isHttps && !flags.secure) missing.push('Secure');
    if (!flags.httpOnly) missing.push('HttpOnly');
    if (!flags.sameSite) missing.push('SameSite');
    if (missing.length === 0) continue;
    findings.push({
      id: `posture-cookie-${cookieName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-flags`,
      name: `Cookie '${cookieName}' Missing Security Attributes`,
      severity,
      scanner: 'posture',
      url: response.finalUrl,
      description: `Cookie '${cookieName}' is missing: ${missing.join(', ')}. ${flags.session ? 'This appears to be a session or authentication cookie, increasing impact if it is exposed or replayed.' : ''}`,
      remediation: 'Set Secure, HttpOnly, and SameSite=Lax or Strict on cookies, especially session and authentication cookies.',
      evidence: evidence({ setCookie: rawCookieFor(response, cookieName) }),
      timestamp: new Date().toISOString()
    });
  }

  const poweredBy = headerValue(response.headers, 'x-powered-by');
  const server = headerValue(response.headers, 'server');
  const versionDisclosure = [poweredBy, server].find(value => /\d+\.\d+/.test(value));
  if (versionDisclosure) {
    findings.push({
      id: 'posture-version-disclosure',
      name: 'Technology Version Disclosure in HTTP Headers',
      severity: 'low',
      scanner: 'posture',
      url: response.finalUrl,
      description: `The response discloses product versions (${[poweredBy, server].filter(Boolean).join('; ')}). Precise version banners reduce attacker reconnaissance cost.`,
      remediation: 'Remove or generalize X-Powered-By and Server version tokens at the reverse proxy/application layer.',
      evidence: evidence(),
      timestamp: new Date().toISOString()
    });
  }

  return findings;
}

function rawCookieFor(response: PostureResponse, cookieName: string): string {
  return response.setCookies.find(raw => raw.split('=')[0]?.trim() === cookieName) || '';
}

export async function runHttpPosture(
  scanId: string,
  targetUrl: string,
  authHeaders: Record<string, string> = {}
): Promise<{ status: 'COMPLETED' | 'DEGRADED' | 'FAILED'; reason: string; resultCount: number; findings: Record<string, unknown>[] }> {
  try {
    const response = await fetchWithSameOriginRedirects(targetUrl, authHeaders);
    if (response.statusCode === 0) {
      throw new Error('No HTTP response was received');
    }

    const forms = /html/i.test(headerValue(response.headers, 'content-type')) || response.body.includes('<form')
      ? extractForms(response.body, response.finalUrl)
      : [];
    if (forms.length > 0) {
      endpointInventory.insert(scanId, targetUrl, 'http-posture', forms);
    }

    const findings = buildPostureFindings(response);
    const result = dbService.insertFindings(scanId, 'posture', findings);

    for (const name of ['server', 'x-powered-by', 'platform', 'panel']) {
      const value = headerValue(response.headers, name);
      if (value) {
        dbService.insertObservation(scanId, 'posture', `http-header-${name}`, value, { url: response.finalUrl });
      }
    }

    const reason = `Built-in HTTP posture check completed (HTTP ${response.statusCode}, ${forms.length} form(s), ${result.insertedFindings.length} finding(s)).`;
    return { status: 'COMPLETED', reason, resultCount: findings.length, findings: result.insertedFindings };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`HTTP posture check failed for ${scanId}: ${message}`);
    return { status: 'FAILED', reason: `Built-in HTTP posture check failed: ${message}`, resultCount: 0, findings: [] };
  }
}
