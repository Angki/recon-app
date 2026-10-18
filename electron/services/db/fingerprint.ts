import crypto from 'crypto';

export interface FingerprintSource {
  scanner: string;
  type?: string;
  name?: string;
  url?: string;
  param?: string;
  endpoint?: string;
  // SAST location
  filePath?: string;
  lineNumber?: number | string;
  ruleId?: string;
  // SCA / Dependency location
  packageName?: string;
  packageVersion?: string;
  cveId?: string;
}

const VOLATILE_QUERY_KEYS = new Set(['_', 'ts', 'timestamp', 'cb', 'nocache', 'cache_bust']);
const SECRET_KEY_REGEX = /^(token|auth|key|secret|jwt|session|sessionid|password|passwd|bearer|sig|signature|api[_-]?key)$/i;

/**
 * Normalizes URL and location preserving case-sensitive paths,
 * line anchors, and redacting secret tokens.
 */
export function normalizeLocation(source: FingerprintSource): string {
  // SAST File location
  if (source.filePath) {
    const cleanPath = source.filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const line = source.lineNumber ? `#L${source.lineNumber}` : '';
    return `file://${cleanPath}${line}`;
  }

  // SCA Package dependency location
  if (source.packageName) {
    const pkg = source.packageName.toLowerCase().trim();
    const ver = (source.packageVersion || '*').trim();
    const cve = source.cveId ? `:${source.cveId.toLowerCase().trim()}` : '';
    return `pkg:${pkg}@${ver}${cve}`;
  }

  const raw = (source.endpoint || source.url || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.host.toLowerCase();
    const pathname = parsed.pathname; // Case preserved: /Admin !== /admin

    // Line anchor check (e.g. file://...#L12)
    const lineMatch = parsed.hash.match(/#L\d+/i);
    const anchor = lineMatch ? `#L${lineMatch[0].slice(2)}` : '';

    // If source.param is provided separately, omit query string from URL location
    if (source.param) {
      return `${protocol}//${host}${pathname}${anchor}`;
    }

    // Otherwise inspect and sort query params, redacting secrets & stripping volatile cachebusters
    const queryEntries: [string, string][] = [];
    parsed.searchParams.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (VOLATILE_QUERY_KEYS.has(lowerKey)) return;
      if (SECRET_KEY_REGEX.test(lowerKey)) {
        queryEntries.push([lowerKey, '[REDACTED]']);
      } else {
        queryEntries.push([lowerKey, val]);
      }
    });

    queryEntries.sort((a, b) => a[0].localeCompare(b[0]));
    const queryStr = queryEntries.map(([k, v]) => `${k}=${v}`).join('&');

    return `${protocol}//${host}${pathname}${queryStr ? '?' + queryStr : ''}${anchor}`;
  } catch {
    // Non-URL raw location: preserve case, normalize slashes
    return raw.replace(/\\/g, '/');
  }
}

/**
 * Computes a deterministic, versioned SHA-256 fingerprint for a security finding.
 * Format: v2:{scanner}:{flawIdentifier}:{normalizedLocation}:{normalizedParam}
 *
 * Guarantees:
 * 1. Path case sensitivity (/Admin vs /admin do not collide).
 * 2. SAST line number and SCA package location support.
 * 3. Secret query values are redacted before hashing.
 * 4. Deterministic 64-character SHA-256 hex string.
 */
export function computeFindingFingerprint(source: FingerprintSource): string {
  const scanner = (source.scanner || 'unknown').toLowerCase().trim();
  const flawIdentifier = (source.ruleId || source.type || source.name || 'unclassified').toLowerCase().trim();
  const location = normalizeLocation(source);
  const param = (source.param || '').toLowerCase().trim();

  const rawKey = `v2:${scanner}:${flawIdentifier}:${location}:${param}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Legacy v1 fingerprint computation for backwards compatibility.
 */
export function computeFindingFingerprintV1(source: FingerprintSource): string {
  const scanner = (source.scanner || 'unknown').toLowerCase().trim();
  const type = (source.type || source.name || 'unclassified').toLowerCase().trim();

  let targetLoc = (source.endpoint || source.url || '').toLowerCase().trim();
  try {
    const parsed = new URL(targetLoc);
    targetLoc = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    // Keep raw location if not standard URL
  }

  const param = (source.param || '').toLowerCase().trim();
  const rawKey = `v1:${scanner}:${type}:${targetLoc}:${param}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}
