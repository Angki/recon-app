import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';
import { safeStorage } from 'electron';

export interface AppSettings {
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
  aiApiKey: string;
  nucleiTemplatesPath?: string;
  wpscanApiToken?: string;
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
  acunetixProfileId: '11111111-1111-1111-1111-111111111111',
  wordlistPath: '',
  aiProvider: 'ollama',
  aiApiKey: '',
  wpscanApiToken: '',
};

const SENSITIVE_FIELDS: (keyof AppSettings)[] = ['acunetixApiKey', 'acunetixPassword', 'aiApiKey', 'wpscanApiToken'];

class SettingsStore {
  private filePath: string;
  private cache: AppSettings | null = null;

  constructor() {
    this.filePath = path.join(os.homedir(), 'Documents', 'SecOpsScans', 'settings.json');
  }

  private encryptField(value: string): string {
    if (!value) return value;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.encryptString(value).toString('base64');
      } catch (e) {
        logger.error('Failed to encrypt field', e);
      }
    }
    return value;
  }

  private decryptField(value: string): string {
    if (!value) return value;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      try {
        // Attempt to decrypt if it looks like base64
        if (value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
           return safeStorage.decryptString(Buffer.from(value, 'base64'));
        }
      } catch {
        // If it fails, it might be plaintext from an old config
        return value;
      }
    }
    return value;
  }

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
          }
        });
        
        this.cache = { ...DEFAULTS, ...parsed };
        return this.cache;
      }
    } catch (err) {
      logger.error('Failed to read settings', err);
    }

    this.cache = { ...DEFAULTS };
    return this.cache;
  }

  save(settings: Partial<AppSettings>): AppSettings {
    const current = this.get();
    const merged = { ...current, ...settings };
    this.cache = merged;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Clone merged to avoid mutating the cache when encrypting
      const toSave: Record<string, unknown> = { ...merged } as unknown as Record<string, unknown>;
      
      // Encrypt sensitive fields before saving
      SENSITIVE_FIELDS.forEach(field => {
        if (toSave[field]) {
          toSave[field] = this.encryptField(toSave[field] as string);
        }
      });
      
      fs.writeFileSync(this.filePath, JSON.stringify(toSave, null, 2));
      logger.info('Settings saved securely');
    } catch (err) {
      logger.error('Failed to save settings', err);
    }

    return merged;
  }
}

export const settingsStore = new SettingsStore();
