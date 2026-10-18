export interface RequestBudget {
  maxTotalRequests?: number;
  maxRequestsPerHost?: number;
  maxDurationMinutes?: number;
  rateLimitPerSecond?: number;
  maxConcurrencyPerHost?: number;
}

export interface EngagementScope {
  id: string;
  name: string;
  targetCanonical: string;
  allowlistDomains: string[];
  allowlistPrefixes?: string[];
  excludedPaths: string[];
  excludedQueryParams: string[];
  budget?: RequestBudget;
}

export interface ScopeEvaluationResult {
  inScope: boolean;
  reason?: string;
  canonicalUrl?: string;
}

export class ScopeEnforcer {
  /**
   * Matches a domain against an allowlist pattern (supports exact match or wildcard *.example.com).
   */
  static domainMatches(hostname: string, pattern: string): boolean {
    const host = hostname.toLowerCase();
    const pat = pattern.toLowerCase().trim();

    if (pat.startsWith('*.')) {
      const rootDomain = pat.slice(2);
      return host === rootDomain || host.endsWith(`.${rootDomain}`);
    }
    return host === pat;
  }

  /**
   * Strictly evaluates if a target or discovered URL falls within engagement boundaries.
   */
  static isUrlInScope(rawUrl: string, scope: EngagementScope): ScopeEvaluationResult {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { inScope: false, reason: 'Malformed URL' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { inScope: false, reason: `Unsupported protocol '${parsed.protocol}'` };
    }

    // 1. Domain Allowlist Check
    const host = parsed.hostname;
    const domainAllowed = scope.allowlistDomains.some(pat => this.domainMatches(host, pat));
    if (!domainAllowed) {
      return {
        inScope: false,
        reason: `Host '${host}' is not in allowed domains [${scope.allowlistDomains.join(', ')}]`
      };
    }

    // 2. Allowlist Prefixes (if specified)
    if (scope.allowlistPrefixes && scope.allowlistPrefixes.length > 0) {
      const prefixAllowed = scope.allowlistPrefixes.some(prefix => parsed.href.startsWith(prefix));
      if (!prefixAllowed) {
        return {
          inScope: false,
          reason: `URL does not match any required scope prefix [${scope.allowlistPrefixes.join(', ')}]`
        };
      }
    }

    // 3. Excluded Paths (e.g. /logout, /delete-account to avoid session destruction)
    const pathname = parsed.pathname.toLowerCase();
    for (const excluded of scope.excludedPaths) {
      const cleanEx = excluded.toLowerCase().trim();
      if (!cleanEx) continue;
      if (pathname === cleanEx || pathname.startsWith(cleanEx.endsWith('/') ? cleanEx : `${cleanEx}/`)) {
        return {
          inScope: false,
          reason: `Path '${parsed.pathname}' matches excluded path rule '${excluded}'`
        };
      }
    }

    // 4. Excluded Query Parameters (e.g. ?logout=true, ?action=destroy)
    for (const param of scope.excludedQueryParams) {
      const cleanParam = param.toLowerCase().trim();
      if (!cleanParam) continue;
      if (parsed.searchParams.has(cleanParam)) {
        return {
          inScope: false,
          reason: `URL matches excluded query parameter rule '${param}'`
        };
      }
    }

    return { inScope: true, canonicalUrl: parsed.href };
  }

  /**
   * Validates whether an HTTP redirect stays strictly within the authorized scope.
   */
  static validateRedirect(originUrl: string, redirectUrl: string, scope: EngagementScope): { allowed: boolean; reason?: string } {
    const evalResult = this.isUrlInScope(redirectUrl, scope);
    if (!evalResult.inScope) {
      return {
        allowed: false,
        reason: `Redirect from ${originUrl} to out-of-scope URL ${redirectUrl}: ${evalResult.reason}`
      };
    }
    return { allowed: true };
  }

  /**
   * Filters a batch of discovered URLs, separating in-scope candidates from rejected ones.
   */
  static filterDiscoveryBatch(urls: string[], scope: EngagementScope): { inScope: string[]; outOfScope: { url: string; reason: string }[] } {
    const inScope: string[] = [];
    const outOfScope: { url: string; reason: string }[] = [];

    for (const u of urls) {
      const res = this.isUrlInScope(u, scope);
      if (res.inScope && res.canonicalUrl) {
        inScope.push(res.canonicalUrl);
      } else {
        outOfScope.push({ url: u, reason: res.reason || 'Out of scope' });
      }
    }

    return { inScope, outOfScope };
  }
}

/**
 * Budget tracker to enforce request and time limits across scan operations.
 */
export class BudgetTracker {
  private requestCount = 0;
  private readonly startTime = Date.now();
  private readonly budget: RequestBudget;

  constructor(budget: RequestBudget = {}) {
    this.budget = budget;
  }

  recordRequest(count = 1): { permitted: boolean; reason?: string } {
    this.requestCount += count;

    if (this.budget.maxTotalRequests && this.requestCount > this.budget.maxTotalRequests) {
      return {
        permitted: false,
        reason: `Request budget exceeded (${this.requestCount} > max ${this.budget.maxTotalRequests})`
      };
    }

    if (this.budget.maxDurationMinutes) {
      const elapsedMinutes = (Date.now() - this.startTime) / 60000;
      if (elapsedMinutes > this.budget.maxDurationMinutes) {
        return {
          permitted: false,
          reason: `Time budget exceeded (${elapsedMinutes.toFixed(1)}m > max ${this.budget.maxDurationMinutes}m)`
        };
      }
    }

    return { permitted: true };
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  getElapsedSeconds(): number {
    return (Date.now() - this.startTime) / 1000;
  }
}
