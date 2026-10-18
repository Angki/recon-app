import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';
import { safeStorage } from 'electron';

export const MASKED_SENTINEL = '••••••••';

export interface AppSettings {
  activePythonPath?: string;
  activePerlPath?: string;
  sqlmapScriptPath?: string;
  commixScriptPath?: string;
  niktoScriptPath?: string;
  niktoRuntime?: 'perl' | 'docker';
  activeDockerPath?: string;
  niktoDockerImage?: string;
  nucleiPath: string;
  wapitiPath: string;
  subfinderPath: string;
  httpxPath: string;
  nmapPath: string;
  zapPath: string;
  katanaPath: string;
  ffufPath: string;
  naabuPath: string;
  dnsxPath: string;
  tlsxPath: string;
  alterxPath: string;
  appscanPath: string;
  netsparkerPath: string;
  acunetixUrl: string;
  acunetixApiKey: string;
  acunetixEmail?: string;
  acunetixPassword?: string;
  acunetixProfileId: string;
  wordlistPath: string;
  aiProvider: string;
  aiBaseUrl: string;
  aiModel: string;
  aiPolicy: 'local-only' | 'hybrid' | 'cloud-allowed';
  aiApiKey: string;
  nucleiTemplatesPath?: string;
  wpscanApiToken?: string;
}

export interface PublicAppSettings extends AppSettings {
  hasAiApiKey: boolean;
  hasAcunetixApiKey: boolean;
  hasAcunetixPassword: boolean;
  hasWpscanApiToken: boolean;
  isStorageEncrypted: boolean;
}

const DEFAULTS: AppSettings = {
  nucleiPath: 'nuclei',
  wapitiPath: 'wapiti',
  subfinderPath: 'subfinder',
  httpxPath: 'httpx',
  nmapPath: 'nmap',
  zapPath: 'zap.bat',
  katanaPath: 'katana',
  ffufPath: 'ffuf',
  naabuPath: 'naabu',
  dnsxPath: 'dnsx',
  tlsxPath: 'tlsx',
  alterxPath: 'alterx',
  appscanPath: 'C:\\Program Files (x86)\\HCL\\AppScan Standard\\AppScanCMD.exe',
  netsparkerPath: 'C:\\Program Files (x86)\\Invicti Professional Edition\\Netsparker.exe',
  acunetixUrl: 'https://127.0.0.1:13443',
  acunetixApiKey: '',
  acunetixEmail: '',
  acunetixPassword: '',
  acunetixProfileId: '',
  wordlistPath: '',
  aiProvider: 'ollama',
  aiBaseUrl: 'http://127.0.0.1:11434',
  aiModel: 'qwen2.5:7b',
  aiPolicy: 'local-only',
  aiApiKey: '',
  wpscanApiToken: '',
};

const SENSITIVE_FIELDS: (keyof AppSettings)[] = ['acunetixApiKey', 'acunetixPassword', 'aiApiKey', 'wpscanApiToken'];

class SettingsStore {
  private filePath: string;
  private cache: AppSettings | null = null;
  private sessionSecrets: Map<string, string> = new Map();

  constructor() {
    this.filePath = path.join(os.homedir(), 'Documents', 'SecOpsScans', 'settings.json');
  }

  private isEncryptionAvailable(): boolean {
    return Boolean(safeStorage && safeStorage.isEncryptionAvailable());
  }

  private encryptField(value: string): string | null {
    if (!value) return '';
    if (this.isEncryptionAvailable()) {
      try {
        return safeStorage.encryptString(value).toString('base64');
      } catch (e) {
        logger.error('Failed to encrypt field via safeStorage', e);
        return null;
      }
    }
    // Fail-closed: do not return plaintext for file storage when encryption is unavailable
    return null;
  }

  private decryptField(value: string): string {
    if (!value) return '';
    if (this.isEncryptionAvailable()) {
      try {
        if (value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
          return safeStorage.decryptString(Buffer.from(value, 'base64'));
        }
      } catch {
        return value;
      }
    }
    return value;
  }

  /**
   * Internal get: returns decrypted values for execution engine use.
   */
  get(): AppSettings {
    if (this.cache) return this.cache;

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        
        // Decrypt sensitive fields
        SENSITIVE_FIELDS.forEach(field => {
          if (parsed[field]) {
            parsed[field] = this.decryptField(parsed[field]);
          } else if (this.sessionSecrets.has(field)) {
            // Restore from session-only memory fallback
            parsed[field] = this.sessionSecrets.get(field);
          }
        });
        
        const result: AppSettings = { ...DEFAULTS, ...parsed };
        this.cache = result;
        return result;
      }
    } catch (err) {
      logger.error('Failed to read settings', err);
    }

    const fallback: AppSettings = { ...DEFAULTS };
    this.cache = fallback;
    return fallback;
  }

  /**
   * Public get: safe for renderer consumption. Masked secrets and boolean metadata only.
   */
  getPublic(): PublicAppSettings {
    const current = this.get();
    const pub: Record<string, unknown> = { ...current };

    pub.hasAiApiKey = Boolean(current.aiApiKey);
    pub.hasAcunetixApiKey = Boolean(current.acunetixApiKey);
    pub.hasAcunetixPassword = Boolean(current.acunetixPassword);
    pub.hasWpscanApiToken = Boolean(current.wpscanApiToken);
    pub.isStorageEncrypted = this.isEncryptionAvailable();

    // Mask sensitive fields
    pub.aiApiKey = current.aiApiKey ? MASKED_SENTINEL : '';
    pub.acunetixApiKey = current.acunetixApiKey ? MASKED_SENTINEL : '';
    pub.acunetixPassword = current.acunetixPassword ? MASKED_SENTINEL : '';
    pub.wpscanApiToken = current.wpscanApiToken ? MASKED_SENTINEL : '';

    return pub as unknown as PublicAppSettings;
  }

  save(settings: Partial<AppSettings>): PublicAppSettings {
    const current = this.get();
    const merged: AppSettings = { ...current };

    // Update fields, preserving existing secrets when sentinel is sent back
    for (const [k, v] of Object.entries(settings)) {
      const key = k as keyof AppSettings;
      if (SENSITIVE_FIELDS.includes(key)) {
        if (v === MASKED_SENTINEL) {
          // Keep current secret
          continue;
        }
      }
      (merged as unknown as Record<string, unknown>)[key] = v;
    }

    this.cache = merged;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const toSave: Record<string, unknown> = { ...merged } as unknown as Record<string, unknown>;
      const encryptionOk = this.isEncryptionAvailable();

      // Encrypt sensitive fields before saving
      SENSITIVE_FIELDS.forEach(field => {
        const secretVal = toSave[field] as string;
        if (secretVal) {
          if (encryptionOk) {
            const encrypted = this.encryptField(secretVal);
            if (encrypted) {
              toSave[field] = encrypted;
            } else {
              delete toSave[field];
              this.sessionSecrets.set(field, secretVal);
            }
          } else {
            // Fail-closed: do NOT write plaintext secret to disk
            logger.warn(`SafeStorage unavailable: '${field}' kept in session memory only (fail-closed)`);
            delete toSave[field];
            this.sessionSecrets.set(field, secretVal);
          }
        }
      });
      
      fs.writeFileSync(this.filePath, JSON.stringify(toSave, null, 2));
      logger.info('Settings saved');
    } catch (err) {
      logger.error('Failed to save settings', err);
    }

    return this.getPublic();
  }
}

export const settingsStore = new SettingsStore();
