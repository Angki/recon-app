import crypto from 'crypto';

export interface FingerprintSource {
  scanner: string;
  type?: string;
  name?: string;
  url?: string;
  param?: string;
  endpoint?: string;
}

/**
 * Computes a deterministic, versioned SHA-256 fingerprint for a security finding.
 * Format: v1:{scanner}:{normalized_type}:{normalized_target}:{normalized_param}
 * 
 * Ensures:
 * 1. Findings with identical flaw at same location share same fingerprint across runs.
 * 2. Findings on different parameters/endpoints remain cleanly separated.
 * 3. Title changes do not artificially mutate finding identity.
 */
export function computeFindingFingerprint(source: FingerprintSource): string {
  const scanner = (source.scanner || 'unknown').toLowerCase().trim();
  const type = (source.type || source.name || 'unclassified').toLowerCase().trim();
  
  // Normalize URL/endpoint (strip volatile query tokens or hashes if present)
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
