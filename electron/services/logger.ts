import fs from 'fs';
import path from 'path';
import os from 'os';

export class LoggerService {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(os.homedir(), 'Documents', 'SecOpsScans', 'logs');
    this.logFile = path.join(this.logDir, 'application.log');
    this.init();
  }

  private init() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  }

  info(message: string) {
    const log = this.formatMessage('info', message);
    fs.appendFileSync(this.logFile, log);
    console.log(log.trim());
  }

  error(message: string, err?: unknown) {
    let errMsg = '';
    if (err) {
      errMsg = err instanceof Error ? ` - ${err.message}` : ` - ${String(err)}`;
    }
    const log = this.formatMessage('error', message + errMsg);
    fs.appendFileSync(this.logFile, log);
    console.error(log.trim());
  }

  warn(message: string) {
    const log = this.formatMessage('warn', message);
    fs.appendFileSync(this.logFile, log);
    console.warn(log.trim());
  }
}

export const logger = new LoggerService();
