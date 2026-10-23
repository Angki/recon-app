/**
 * Curated advisory correlation for service versions explicitly observed by
 * reconnaissance engines. This is deliberately a small, high-confidence
 * catalog: advisory matches are labeled as correlation, never as verified
 * exploitation, and are deduplicated per host/CVE.
 */
export interface AdvisoryEntry {
  product: string;
  cve: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  affected: { minInclusive?: string; maxInclusive?: string; exact?: string[] };
  remediation: string;
  reference: string;
}

export interface DetectedProduct {
  product: string;
  version: string;
  url: string;
  sourceId?: string;
}

export const ADVISORY_CATALOG: AdvisoryEntry[] = [
  {
    product: 'apache http server',
    cve: 'CVE-2021-41773',
    title: 'Apache HTTP Server path traversal and remote code execution',
    severity: 'high',
    affected: { exact: ['2.4.49'] },
    remediation: 'Upgrade Apache HTTP Server to 2.4.51 or later and ensure the default require-all-denied policy is present.',
    reference: 'https://nvd.nist.gov/vuln/detail/CVE-2021-41773'
  },
  {
    product: 'apache http server',
    cve: 'CVE-2021-42013',
    title: 'Apache HTTP Server path traversal (incomplete fix for CVE-2021-41773)',
    severity: 'high',
    affected: { exact: ['2.4.50'] },
    remediation: 'Upgrade Apache HTTP Server to 2.4.51 or later.',
    reference: 'https://nvd.nist.gov/vuln/detail/CVE-2021-42013'
  },
  {
    product: 'openssh',
    cve: 'CVE-2024-6387',
    title: 'OpenSSH regreSSHion unauthenticated remote code execution',
    severity: 'high',
    affected: { minInclusive: '8.5', maxInclusive: '9.7' },
    remediation: 'Upgrade OpenSSH to 9.8 or later; restrict SSH exposure to trusted networks while patching.',
    reference: 'https://nvd.nist.gov/vuln/detail/CVE-2024-6387'
  },
  {
    product: 'proftpd',
    cve: 'CVE-2019-12815',
    title: 'ProFTPD mod_copy unauthenticated arbitrary file copy',
    severity: 'high',
    affected: { maxInclusive: '1.3.5' },
    remediation: 'Upgrade ProFTPD to 1.3.6 or later, or disable the mod_copy module.',
    reference: 'https://nvd.nist.gov/vuln/detail/CVE-2019-12815'
  },
  {
    product: 'exim',
    cve: 'CVE-2019-10149',
    title: 'Exim remote command execution in the deliver request',
    severity: 'high',
    affected: { minInclusive: '4.87', maxInclusive: '4.91' },
    remediation: 'Upgrade Exim to 4.92 or later.',
    reference: 'https://nvd.nist.gov/vuln/detail/CVE-2019-10149'
  },
  {
    product: 'vsftpd',
    cve: 'CVE-2011-2523',
    title: 'vsftpd 2.3.4 backdoor command execution',
    severity: 'high',
    affected: { exact: ['2.3.4'] },
    remediation: 'Replace the vsftpd 2.3.4 binary with a verified package and rebuild the host if compromise is suspected.',
    reference: 'https://nvd.nist.gov/vuln/detail/CVE-2011-2523'
  },
  {
    product: 'openssl',
    cve: 'CVE-2014-0160',
    title: 'OpenSSL Heartbleed memory disclosure',
    severity: 'high',
    affected: { minInclusive: '1.0.1', maxInclusive: '1.0.1f' },
    remediation: 'Upgrade OpenSSL and rotate any private keys or session material exposed while the vulnerable library was active.',
    reference: 'https://nvd.nist.gov/vuln/detail/CVE-2014-0160'
  },
  {
    product: 'openssl',
    cve: 'CVE-2022-3602',
    title: 'OpenSSL X.509 email address buffer overflow',
    severity: 'high',
    affected: { minInclusive: '3.0.0', maxInclusive: '3.0.6' },
    remediation: 'Upgrade OpenSSL 3.x to 3.0.7 or later.',
    reference: 'https://nvd.nist.gov/vuln/detail/CVE-2022-3602'
  }
];

const PRODUCT_PATTERNS: Array<{ product: string; regex: RegExp; versionIndex: number }> = [
  { product: 'apache http server', regex: /\bApache(?: HTTP Server| httpd)?[/ ]([0-9]+(?:\.[0-9]+){1,3})/i, versionIndex: 1 },
  { product: 'openssh', regex: /\bOpenSSH[ _/]([0-9]+(?:\.[0-9]+){1,2})(?:p[0-9]+)?/i, versionIndex: 1 },
  { product: 'proftpd', regex: /\bProFTPD[ _/]([0-9]+(?:\.[0-9]+){1,2})/i, versionIndex: 1 },
  { product: 'exim', regex: /\bExim[ _/]([0-9]+(?:\.[0-9]+){1,2})/i, versionIndex: 1 },
  { product: 'vsftpd', regex: /\bvsftpd[ _/]([0-9]+(?:\.[0-9]+){1,2})/i, versionIndex: 1 },
  { product: 'openssl', regex: /\bOpenSSL[ _/]([0-9]+(?:\.[0-9]+){1,2}[a-z]?)/i, versionIndex: 1 }
];

function versionParts(version: string): number[] {
  const normalized = version.toLowerCase().replace(/^v/, '').replace(/p[0-9]+$/, '').trim();
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)*)([a-z])?$/);
  if (match) {
    const parts = match[1].split('.').map(Number);
    if (match[2]) parts.push(match[2].charCodeAt(0) - 96);
    return parts;
  }
  return normalized
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number)
    .filter(part => Number.isFinite(part));
}

export function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l < r ? -1 : 1;
  }
  return 0;
}

export function isVersionAffected(version: string, affected: AdvisoryEntry['affected']): boolean {
  const normalized = version.replace(/p[0-9]+$/i, '');
  if (affected.exact) {
    return affected.exact.some(candidate => compareVersions(normalized, candidate) === 0);
  }
  if (affected.minInclusive && compareVersions(normalized, affected.minInclusive) < 0) return false;
  if (affected.maxInclusive && compareVersions(normalized, affected.maxInclusive) > 0) return false;
  return true;
}

export function extractDetectedProducts(findings: Record<string, unknown>[]): DetectedProduct[] {
  const detected: DetectedProduct[] = [];
  const seen = new Set<string>();
  for (const finding of findings) {
    const haystack = `${String(finding.name || '')}\n${String(finding.description || '')}\n${String(finding.rawJson || '')}`;
    for (const { product, regex, versionIndex } of PRODUCT_PATTERNS) {
      const match = haystack.match(regex);
      if (!match) continue;
      const version = match[versionIndex];
      if (!version) continue;
      const key = `${product}@${version}@${String(finding.url || '')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      detected.push({
        product,
        version,
        url: String(finding.url || ''),
        sourceId: finding.id ? String(finding.id) : undefined
      });
    }
  }
  return detected;
}

export function correlateServiceAdvisories(
  findings: Record<string, unknown>[],
  scanner: string
): Record<string, unknown>[] {
  const detected = extractDetectedProducts(findings);
  if (detected.length === 0) return findings;

  const alreadyReported = new Set(
    findings
      .map(finding => String(finding.cveId || finding.cve || '').toLowerCase())
      .filter(Boolean)
  );
  const correlated: Record<string, unknown>[] = [];

  for (const item of detected) {
    for (const advisory of ADVISORY_CATALOG) {
      if (advisory.product !== item.product) continue;
      if (alreadyReported.has(advisory.cve.toLowerCase())) continue;
      if (!isVersionAffected(item.version, advisory.affected)) continue;

      alreadyReported.add(advisory.cve.toLowerCase());
      correlated.push({
        id: `advisory-${advisory.cve.toLowerCase()}`,
        name: `${advisory.title} (${advisory.cve})`,
        severity: advisory.severity,
        scanner,
        url: item.url,
        cveId: advisory.cve,
        confidence: 'low',
        description:
          `ADVISORY CORRELATION ONLY: detected ${item.product} ${item.version}, which falls inside the published affected range for ${advisory.cve}. ` +
          'The service version was fingerprinted, but exploitation was not attempted; validate the exact build, backported patches, and vendor advisory before remediation planning.\n\n' +
          `Remediation: ${advisory.remediation}\nReference: ${advisory.reference}`,
        remediation: advisory.remediation,
        references: [advisory.reference],
        evidence: {
          type: 'version-advisory-correlation',
          product: item.product,
          detectedVersion: item.version,
          cve: advisory.cve,
          affected: advisory.affected,
          sourceFindingId: item.sourceId,
          sourceScanner: scanner
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  return correlated.length > 0 ? [...findings, ...correlated] : findings;
}
