import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { settingsStore, MASKED_SENTINEL } from '../settings';

export type AuthType = 'bearer' | 'basic' | 'apiKey' | 'cookie' | 'custom';

export interface SessionHealthConfig {
  endpointUrl: string;
  expectedStatus?: number;
  expectedField?: string;
  timeoutMs?: number;
}

export interface CsrfConfig {
  tokenHeader: string;
  cookieName?: string;
  fetchUrl?: string;
}

export interface RefreshConfig {
  refreshUrl: string;
  refreshTokenRef: string;
  grantType?: string;
}

export interface AuthProfile {
  id: string;
  name: string;
  type: AuthType;
  secretRef: string; // Secure reference key in vault, never plaintext in exports/previews
  headerName?: string; // For apiKey or custom
  expiresAt?: string; // ISO 8601 timestamp
  sessionHealthCheck?: SessionHealthConfig;
  csrfConfig?: CsrfConfig;
  refreshConfig?: RefreshConfig;
  createdAt: string;
  updatedAt: string;
}

export class AuthSessionError extends Error {
  public readonly code: 'AUTH_EXPIRED' | 'AUTH_INVALID' | 'AUTH_VAULT_MISSING';
  constructor(code: 'AUTH_EXPIRED' | 'AUTH_INVALID' | 'AUTH_VAULT_MISSING', message: string) {
    super(message);
    this.name = 'AuthSessionError';
    this.code = code;
  }
}

/**
 * In-memory vault mapping secretRef -> rawSecret.
 * Initialized from settings or runtime memory to prevent secrets in database tables or logs.
 */
class SecureVault {
  private secrets = new Map<string, string>();

  storeSecret(secretRef: string, rawSecret: string) {
    this.secrets.set(secretRef, rawSecret);
  }

  getSecret(secretRef: string): string | undefined {
    return this.secrets.get(secretRef);
  }

  deleteSecret(secretRef: string) {
    this.secrets.delete(secretRef);
  }
}

export const secureVault = new SecureVault();

export class AuthService {
  private profiles = new Map<string, AuthProfile>();

  createProfile(params: {
    name: string;
    type: AuthType;
    rawSecret: string;
    headerName?: string;
    expiresAt?: string;
    sessionHealthCheck?: SessionHealthConfig;
    csrfConfig?: CsrfConfig;
    refreshConfig?: RefreshConfig;
  }): AuthProfile {
    const id = `auth_${crypto.randomUUID()}`;
    const secretRef = `vault://auth/${id}/token`;

    secureVault.storeSecret(secretRef, params.rawSecret);

    const profile: AuthProfile = {
      id,
      name: params.name,
      type: params.type,
      secretRef,
      headerName: params.headerName,
      expiresAt: params.expiresAt,
      sessionHealthCheck: params.sessionHealthCheck,
      csrfConfig: params.csrfConfig,
      refreshConfig: params.refreshConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.profiles.set(id, profile);
    return profile;
  }

  getProfile(id: string): AuthProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Returns a sanitized profile for UI/IPC/Export with secrets strictly masked.
   */
  getPublicProfile(profile: AuthProfile): Omit<AuthProfile, 'secretRef'> & { hasSecret: boolean; maskedToken: string } {
    const hasSecret = Boolean(secureVault.getSecret(profile.secretRef));
    return {
      id: profile.id,
      name: profile.name,
      type: profile.type,
      headerName: profile.headerName,
      expiresAt: profile.expiresAt,
      sessionHealthCheck: profile.sessionHealthCheck,
      csrfConfig: profile.csrfConfig,
      refreshConfig: profile.refreshConfig,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      hasSecret,
      maskedToken: hasSecret ? MASKED_SENTINEL : ''
    };
  }

  /**
   * Checks if session has expired according to expiresAt timestamp.
   */
  isSessionExpired(profile: AuthProfile): boolean {
    if (!profile.expiresAt) return false;
    const expiryTime = new Date(profile.expiresAt).getTime();
    if (isNaN(expiryTime)) return false;
    return Date.now() >= expiryTime;
  }

  /**
   * Validates auth session status prior to scanner launch.
   * Fails closed: Never proceeds with an expired or invalid session as an authenticated scan!
   */
  async validateSessionForLaunch(profile: AuthProfile): Promise<{ valid: boolean; resolvedHeader: string }> {
    // 1. Expiry Check
    if (this.isSessionExpired(profile)) {
      throw new AuthSessionError(
        'AUTH_EXPIRED',
        `Authentication session for profile '${profile.name}' expired at ${profile.expiresAt}. Scan aborted to prevent false clean results.`
      );
    }

    // 2. Secret presence in vault
    const rawSecret = secureVault.getSecret(profile.secretRef);
    if (!rawSecret) {
      throw new AuthSessionError(
        'AUTH_VAULT_MISSING',
        `Secret credentials for profile '${profile.name}' are missing from secure vault. Re-authenticate before scanning.`
      );
    }

    // 3. Active Session Health Probe (if configured)
    if (profile.sessionHealthCheck?.endpointUrl) {
      const probeResult = await this.probeSessionHealth(profile.sessionHealthCheck, rawSecret, profile.type);
      if (!probeResult.healthy) {
        throw new AuthSessionError(
          'AUTH_INVALID',
          `Session health check failed for profile '${profile.name}' (${probeResult.error || 'HTTP ' + probeResult.statusCode}). Scan aborted to prevent unauthenticated execution.`
        );
      }
    }

    // 4. Build resolved Authorization header for process injection
    let resolvedHeader: string;
    switch (profile.type) {
      case 'bearer':
        resolvedHeader = `Bearer ${rawSecret}`;
        break;
      case 'basic':
        resolvedHeader = `Basic ${rawSecret.includes(':') ? Buffer.from(rawSecret).toString('base64') : rawSecret}`;
        break;
      case 'apiKey':
        resolvedHeader = `${profile.headerName || 'X-API-Key'}: ${rawSecret}`;
        break;
      default:
        resolvedHeader = rawSecret;
    }

    return { valid: true, resolvedHeader };
  }

  /**
   * Active preflight probe to verify session health on remote endpoint.
   */
  private probeSessionHealth(
    healthCheck: SessionHealthConfig,
    rawSecret: string,
    type: AuthType
  ): Promise<{ healthy: boolean; statusCode?: number; error?: string }> {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(healthCheck.endpointUrl);
        const isHttps = parsed.protocol === 'https:';
        const client = isHttps ? https : http;

        const headers: Record<string, string> = {
          'User-Agent': 'SecOps-Recon-Auth-Probe/2.0'
        };

        if (type === 'bearer') {
          headers['Authorization'] = `Bearer ${rawSecret}`;
        } else if (type === 'basic') {
          headers['Authorization'] = `Basic ${rawSecret.includes(':') ? Buffer.from(rawSecret).toString('base64') : rawSecret}`;
        }

        const req = client.request(
          parsed,
          {
            method: 'GET',
            headers,
            timeout: healthCheck.timeoutMs || 5000
          },
          (res) => {
            const expected = healthCheck.expectedStatus || 200;
            const healthy = res.statusCode === expected;
            resolve({
              healthy,
              statusCode: res.statusCode,
              error: healthy ? undefined : `Expected status ${expected}, received ${res.statusCode}`
            });
          }
        );

        req.on('error', (err) => {
          resolve({ healthy: false, error: err.message });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ healthy: false, error: 'Session health check timed out' });
        });

        req.end();
      } catch (err: unknown) {
        resolve({ healthy: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
  }
}

export const authService = new AuthService();
