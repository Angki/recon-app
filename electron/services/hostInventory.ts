import fs from 'node:fs';
import path from 'node:path';
import type { ScannerContext } from './scanners/types';

export const HOST_SOURCE_SCANNERS = new Set(['subfinder', 'alterx', 'dnsx', 'tlsx', 'httpx', 'naabu']);

const HOSTS_FILE = 'discovered_hosts.txt';
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function rootHost(target: string): string | null {
  try {
    const value = /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : `https://${target}`;
    const host = new URL(value).hostname.toLowerCase().replace(/\.$/, '');
    return HOSTNAME_PATTERN.test(host) ? host : null;
  } catch {
    return null;
  }
}

function normalizeHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let candidate = value.trim().toLowerCase();
  if (!candidate) return null;

  if (candidate.includes('://')) {
    try {
      candidate = new URL(candidate).hostname.toLowerCase();
    } catch {
      return null;
    }
  } else {
    candidate = candidate.split('/')[0].split('?')[0].split('#')[0].replace(/:\d+$/, '');
  }

  candidate = candidate.replace(/\.$/, '');
  return HOSTNAME_PATTERN.test(candidate) ? candidate : null;
}

export function normalizeInScopeHosts(target: string, hosts: Iterable<unknown>): string[] {
  const root = rootHost(target);
  if (!root) return [];

  const scoped = new Set<string>();
  for (const value of hosts) {
    const host = normalizeHost(value);
    if (!host) continue;
    if (host !== root && !host.endsWith(`.${root}`)) continue;
    scoped.add(host);
  }
  scoped.add(root);
  return Array.from(scoped).sort();
}

function artifactHosts(ctx: ScannerContext): string[] {
  const file = ctx.scannerName === 'alterx' ? ctx.outputFile : ctx.jsonFile;
  const hosts: string[] = [];
  try {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return hosts;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed) as Record<string, unknown>;
        for (const value of [data.host, data.input, data.url, data.final_url]) {
          if (typeof value === 'string') hosts.push(value);
        }
      } catch {
        hosts.push(trimmed);
      }
    }
  } catch {
    // Host extraction is best-effort; the engine's own findings remain authoritative.
  }
  return hosts;
}

function hostsFilePath(ctx: ScannerContext): string {
  return path.join(ctx.outDir, HOSTS_FILE);
}

export function captureDiscoveredHosts(ctx: ScannerContext): string[] {
  const existing: string[] = [];
  try {
    if (fs.existsSync(hostsFilePath(ctx))) {
      existing.push(...fs.readFileSync(hostsFilePath(ctx), 'utf8').split(/\r?\n/));
    }
  } catch {
    // Start from the newly discovered hosts if the previous snapshot is unreadable.
  }

  const hosts = normalizeInScopeHosts(ctx.targetUrl || ctx.domain, [
    ...existing,
    ctx.domain,
    ...artifactHosts(ctx)
  ]);

  try {
    fs.mkdirSync(ctx.outDir, { recursive: true });
    fs.writeFileSync(hostsFilePath(ctx), `${hosts.join('\n')}\n`, 'utf8');
  } catch {
    // Downstream engines fall back to their single-target arguments.
  }

  return hosts;
}

export function discoveredHostsFile(ctx: ScannerContext): string | null {
  try {
    const file = hostsFilePath(ctx);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
    const hosts = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim());
    return hosts.length > 1 ? file : null;
  } catch {
    return null;
  }
}
