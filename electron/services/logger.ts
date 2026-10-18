import fs from 'fs';
import path from 'path';
import os from 'os';

export interface OperationLogData {
  runId?: string;
  jobId?: string;
  tool?: string;
  toolVersion?: string;
  action: string;
  durationMs?: number;
  errorCode?: string | number;
  status: 'STARTED' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  details?: Record<string, unknown>;
}

export class LoggerService {
  private logDir: string;
  private logFile: string;
  private operationsFile: string;
  private maxSizeBytes: number = 5 * 1024 * 1024; // 5 MB
  private maxRotatedFiles: number = 3;

  constructor() {
    this.logDir = path.join(os.homedir(), 'Documents', 'SecOpsScans', 'logs');
    this.logFile = path.join(this.logDir, 'application.log');
    this.operationsFile = path.join(this.logDir, 'operations.jsonl');
    this.init();
  }

  private init() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  static redactSensitive(text: string): string {
    if (!text) return '';
    return text
      .replace(/Bearer\s+[A-Za-z0-9_\-.]+/gi, 'Bearer [REDACTED]')
      .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]')
      .replace(/(api[_-]?key|password|token|secret|access_token|auth_token)\s*[:=]\s*["']?([^\s"',&]+)["']?/gi, '$1=[REDACTED]');
  }

  private rotateIfNeeded(targetPath: string) {
    try {
      if (!fs.existsSync(targetPath)) return;
      const stats = fs.statSync(targetPath);
      if (stats.size < this.maxSizeBytes) return;

      // Rotate existing backups: .2 -> .3, .1 -> .2
      for (let i = this.maxRotatedFiles - 1; i >= 1; i--) {
        const older = `${targetPath}.${i}`;
        const newer = `${targetPath}.${i + 1}`;
        if (fs.existsSync(older)) {
          fs.renameSync(older, newer);
        }
      }

      // Rename current to .1
      fs.renameSync(targetPath, `${targetPath}.1`);
    } catch (err) {
      console.error('Failed to rotate log file:', err);
    }
  }

  private static formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const sanitized = LoggerService.redactSensitive(message);
    return `[${timestamp}] [${level.toUpperCase()}] ${sanitized}\n`;
  }

  info = (message: string, context?: string) => {
    const formatted = context ? `[${context}] ${message}` : message;
    const log = LoggerService.formatMessage('info', formatted);
    this.rotateIfNeeded(this.logFile);
    fs.appendFileSync(this.logFile, log);
    console.log(log.trim());
  };

  error = (message: string, err?: unknown, context?: string) => {
    let errMsg = '';
    if (err) {
      errMsg = err instanceof Error ? ` - ${err.message}` : ` - ${String(err)}`;
    }
    const formatted = context ? `[${context}] ${message}${errMsg}` : message + errMsg;
    const log = LoggerService.formatMessage('error', formatted);
    this.rotateIfNeeded(this.logFile);
    fs.appendFileSync(this.logFile, log);
    console.error(log.trim());
  };

  warn = (message: string, context?: string) => {
    const formatted = context ? `[${context}] ${message}` : message;
    const log = LoggerService.formatMessage('warn', formatted);
    this.rotateIfNeeded(this.logFile);
    fs.appendFileSync(this.logFile, log);
    console.warn(log.trim());
  };

  debug = (message?: unknown, ..._additionalArgs: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      const msg = typeof message === 'string' ? message : String(message ?? '');
      const log = LoggerService.formatMessage('debug', msg);
      this.rotateIfNeeded(this.logFile);
      fs.appendFileSync(this.logFile, log);
    }
  };

  static sanitizeObject(obj: unknown): unknown {
    if (typeof obj === 'string') return LoggerService.redactSensitive(obj);
    if (Array.isArray(obj)) return obj.map(item => LoggerService.sanitizeObject(item));
    if (obj !== null && typeof obj === 'object') {
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (/token|secret|password|key|auth/i.test(k)) {
          res[k] = '[REDACTED]';
        } else {
          res[k] = LoggerService.sanitizeObject(v);
        }
      }
      return res;
    }
    return obj;
  }

  logOperation = (data: OperationLogData) => {
    const entry = {
      timestamp: new Date().toISOString(),
      runId: data.runId,
      jobId: data.jobId,
      tool: data.tool,
      toolVersion: data.toolVersion,
      action: data.action,
      status: data.status,
      durationMs: data.durationMs,
      errorCode: data.errorCode,
      details: data.details ? LoggerService.sanitizeObject(data.details) : undefined
    };
    this.rotateIfNeeded(this.operationsFile);
    fs.appendFileSync(this.operationsFile, JSON.stringify(entry) + '\n');
  };

  getRecentLogs = (maxLines: number = 200): string[] => {
    if (!fs.existsSync(this.logFile)) return [];
    try {
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim() !== '');
      return lines.slice(-maxLines);
    } catch {
      return [];
    }
  };

  getDiagnosticsSummary = (): Record<string, unknown> => {
    return {
      timestamp: new Date().toISOString(),
      os: {
        platform: process.platform,
        arch: process.arch,
        release: os.release(),
        totalMemoryBytes: os.totalmem(),
        freeMemoryBytes: os.freemem()
      },
      process: {
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron,
        uptimeSeconds: Math.floor(process.uptime())
      },
      logStats: {
        applicationLogExists: fs.existsSync(this.logFile),
        applicationLogSizeBytes: fs.existsSync(this.logFile) ? fs.statSync(this.logFile).size : 0,
        operationsLogExists: fs.existsSync(this.operationsFile),
        operationsLogSizeBytes: fs.existsSync(this.operationsFile) ? fs.statSync(this.operationsFile).size : 0
      }
    };
  };
}

export const logger = new LoggerService();
