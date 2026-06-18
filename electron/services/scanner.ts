import { spawn, ChildProcess, execSync } from 'child_process';
import { logger } from './logger';
import { storage } from './storage';
import { settingsStore } from './settings';
import path from 'path';
const { XMLParser } = require('fast-xml-parser');

import fs from 'fs';
import os from 'os';

/** Safely send IPC to renderer — no-op if the window was already closed */
function safeSend(sender: Electron.WebContents, channel: string, data: any) {
  if (!sender.isDestroyed()) {
    sender.send(channel, data);
  }
}

class IpcBatcher {
  private buffer: Map<string, string> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private sender: Electron.WebContents | null = null;

  send(sender: Electron.WebContents, scanId: string, scanner: string, type: string, message: string) {
    this.sender = sender;
    const key = `${scanId}:${scanner}:${type}`;
    const existing = this.buffer.get(key) || '';
    this.buffer.set(key, existing + message);

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 100);
    }
  }

  flush() {
    if (!this.sender || this.sender.isDestroyed()) {
      this.buffer.clear();
      this.timer = null;
      return;
    }
    
    for (const [key, msg] of this.buffer.entries()) {
      const [scanId, scanner, type] = key.split(':');
      safeSend(this.sender, 'scan:output', { scanId, scanner, type, message: msg });
    }
    this.buffer.clear();
    this.timer = null;
  }
}

const stdoutBatcher = new IpcBatcher();
const stderrBatcher = new IpcBatcher();


export class ScannerService {
  private activeScans: Map<string, { [scanner: string]: ChildProcess }> = new Map();
  private scanStats: Map<string, { nuclei: any, wapiti: any }> = new Map();
  private statEmitIntervals: Map<string, NodeJS.Timeout> = new Map();

  /** Check if a CLI tool is available on PATH */
  async checkTool(name: string): Promise<{ available: boolean; version?: string; resolvedPath?: string }> {
    try {
      if (path.isAbsolute(name) && fs.existsSync(name)) {
        return { available: true, resolvedPath: name };
      }

      // Prioritize Go bin directory for ProjectDiscovery tools to avoid clashes (e.g. Python's httpx)
      if (process.platform === 'win32' && ['httpx', 'subfinder', 'nuclei'].includes(name)) {
        const goPath = path.join(os.homedir(), 'go', 'bin', `${name}.exe`);
        if (fs.existsSync(goPath)) {
          return { available: true, resolvedPath: goPath };
        }
      }

      const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
      const output = execSync(cmd, { stdio: 'pipe' }).toString().trim();
      const firstPath = output.split('\n')[0].trim();
      return { available: true, resolvedPath: firstPath };
    } catch {
      // Windows fallbacks
      if (process.platform === 'win32' && name === 'nmap') {
        const fallbacks = [
          'C:\\Program Files (x86)\\Nmap\\nmap.exe',
          'C:\\Program Files\\Nmap\\nmap.exe'
        ];
        for (const p of fallbacks) {
          if (fs.existsSync(p)) return { available: true, resolvedPath: p };
        }
      }
      return { available: false };
    }
  }

  async startScan(sender: Electron.WebContents, targetUrl: string, config: any) {
    try {
      let finalUrl = targetUrl.trim();
      if (!finalUrl.startsWith('http')) finalUrl = `https://${finalUrl}`;
      try {
        const parsed = new URL(finalUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { success: false, error: 'Invalid URL protocol' };
        }
        targetUrl = finalUrl;
      } catch {
        return { success: false, error: 'Invalid URL format' };
      }
      
      const settings = settingsStore.get();
      const urlObj = new URL(targetUrl);
      const domain = urlObj.hostname;

      // Extract requested tools from config, default to nuclei and wapiti if none provided
      const requestedTools = config.tools || ['nuclei', 'wapiti'];

      // Mapping of tool names to their configured binaries
      const toolBinaries: Record<string, string> = {
        nuclei: settings.nucleiPath || 'nuclei',
        wapiti: settings.wapitiPath || 'wapiti',
        subfinder: settings.subfinderPath || 'subfinder',
        httpx: settings.httpxPath || 'httpx',
        nmap: settings.nmapPath || 'nmap',
        zap: settings.zapPath || 'zap.bat',
        katana: settings.katanaPath || 'katana',
        ffuf: settings.ffufPath || 'ffuf',
        appscan: settings.appscanPath || 'C:\\Program Files (x86)\\HCL\\AppScan Standard\\AppScanCMD.exe',
        netsparker: settings.netsparkerPath || path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Invicti Professional Edition', 'Netsparker.exe'),
        acunetix: process.execPath, // We use bundled Electron Node to run the API runner script
        wpscan: 'docker', // wpscan runs via docker
      };

      const toolsToRun = requestedTools.filter((t: string) => toolBinaries[t]);

      // Pre-flight: verify requested tools exist
      const checks = await Promise.all(toolsToRun.map((t: string) => this.checkTool(toolBinaries[t])));
      
      const missing: string[] = [];
      toolsToRun.forEach((t: string, idx: number) => {
        if (!checks[idx].available) {
          missing.push(`${t} ("${toolBinaries[t]}")`);
        } else if (checks[idx].resolvedPath) {
          toolBinaries[t] = checks[idx].resolvedPath;
        }
      });

      if (missing.length > 0) {
        return {
          success: false,
          error: `Tool not found on PATH: ${missing.join(', ')}. Install them or configure the binary path in Settings.`,
        };
      }

      const { scanId, scanDir, nucleiDir, wapitiDir } = storage.createScanDirectory(domain);
      
      storage.saveMetadata(scanId, {
        scanId,
        target: targetUrl,
        domain,
        startTime: new Date().toISOString(),
        status: 'RUNNING',
        config: { ...config, tools: toolsToRun },
      });

      this.activeScans.set(scanId, {});
      this.scanStats.set(scanId, {
        nuclei: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
        wapiti: { vulns: 0, pages: 0 }
      });
      this.statEmitIntervals.set(scanId, setInterval(() => {
        const stats = this.scanStats.get(scanId);
        if (stats) safeSend(sender, 'scan:stats', { scanId, stats });
      }, 1000));

      // Start requested tools
      for (const tool of toolsToRun) {
        // We reuse the scanDir (or existing subdirs) for output
        const outDir = tool === 'nuclei' ? nucleiDir : tool === 'wapiti' ? wapitiDir : scanDir;
        this.runGenericTool(sender, scanId, targetUrl, domain, tool, toolBinaries[tool], outDir, config);
      }

      return { success: true, scanId };
    } catch (error: any) {
      logger.error('Failed to start scan', error);
      return { success: false, error: error.message };
    }
  }

  private runGenericTool(
    sender: Electron.WebContents,
    scanId: string,
    targetUrl: string,
    domain: string,
    scannerName: string,
    bin: string,
    outDir: string,
    config?: any
  ) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const outputFile = path.join(outDir, `${scannerName}_${domain}_${timestamp}.txt`);
    const jsonFile = path.join(outDir, `${scannerName}_${domain}_${timestamp}.json`);
    const xmlFile = path.join(outDir, `${scannerName}_${domain}_${timestamp}.xml`);

    const adapter = require('./scanners/registry').getAdapter(scannerName);
    const context = {
      scanId, targetUrl, domain, scannerName, bin, outDir, config,
      timestamp, outputFile, jsonFile, xmlFile, sender,
      settings: settingsStore.get()
    };

    const args = adapter.getCommandArgs(context);
    
    let env = { ...process.env };
    if (adapter.getEnv) {
      env = adapter.getEnv(context, env);
    }
    
    let executable = bin;
    let useShell = false;
    let cwd = process.cwd();
    let spawnArgs = args;

    const isBat = bin.toLowerCase().endsWith('.bat') || bin.toLowerCase().endsWith('.cmd');
    if (isBat && process.platform === 'win32') {
      executable = process.env.comspec || 'cmd.exe';
      spawnArgs = ['/c', path.basename(bin), ...args];
      cwd = path.dirname(bin);
    } else if (isBat) {
      useShell = true;
    }

    if (adapter.getProcessOptions) {
      const opts = adapter.getProcessOptions(context, { executable, args: spawnArgs, useShell, cwd });
      executable = opts.executable;
      spawnArgs = opts.args;
      useShell = opts.useShell;
      if (opts.cwd) cwd = opts.cwd;
    }

    const processInstance = spawn(executable, spawnArgs, { 
      env, 
      cwd, 
      shell: useShell,
      windowsVerbatimArguments: false 
    });
    
    if (processInstance.stdin && adapter.handleStdin) {
      adapter.handleStdin(context, processInstance);
    }
    if (processInstance.stdin && !processInstance.stdin.writableEnded) {
      processInstance.stdin.end();
    }

    const scanSession = this.activeScans.get(scanId);
    if (scanSession) scanSession[scannerName] = processInstance;

    processInstance.stdout?.on('data', (data) => {
      const msg = data.toString();
      stdoutBatcher.send(sender, scanId, scannerName, 'stdout', msg);
      
      const stats = this.scanStats.get(scanId);
      if (stats && adapter.processStdout) {
        adapter.processStdout(context, msg, stats);
      }
    });

    processInstance.stderr?.on('data', (data) => {
      stderrBatcher.send(sender, scanId, scannerName, 'stderr', data.toString());
    });

    processInstance.on('error', (err) => {
      logger.error(`Failed to start ${scannerName}:`, err);
      safeSend(sender, 'scan:output', { scanId, scanner: scannerName, type: 'stderr', message: `[SYSTEM ERROR] Failed to spawn process: ${err.message}\nPlease check if the tool is installed and the path is correct in Settings.` });
      storage.updateStatus(scanId, scannerName, 'FAILED');
      safeSend(sender, 'scan:status', { scanId, scanner: scannerName, status: 'FAILED' });
    });

    processInstance.on('exit', (code) => {
      logger.info(`${scannerName} process for ${scanId} exited with code ${code}`);
      
      const fileToRead = ['alterx', 'nmap'].includes(scannerName) ? outputFile : 
                         ['appscan', 'netsparker'].includes(scannerName) ? xmlFile : jsonFile;
      if (fs.existsSync(fileToRead)) {
        try {
          const stats = fs.statSync(fileToRead);
          if (stats.size > 0 && stats.size < 5 * 1024 * 1024) { // Max 5MB dump
            const content = fs.readFileSync(fileToRead, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim() !== '');
            if (lines.length > 30) {
              safeSend(sender, 'scan:output', { scanId, scanner: scannerName, type: 'stdout', message: `\n[SYSTEM] Tool finished. Generated ${lines.length} items. Last 10 lines:\n${lines.slice(-10).join('\n')}` });
            } else {
              safeSend(sender, 'scan:output', { scanId, scanner: scannerName, type: 'stdout', message: `\n[SYSTEM] Tool finished. Output:\n${content}` });
            }
          } else if (stats.size > 0) {
            safeSend(sender, 'scan:output', { scanId, scanner: scannerName, type: 'stdout', message: `\n[SYSTEM] Tool finished. Output file generated (Size: ${(stats.size/1024/1024).toFixed(2)} MB)` });
          }
        } catch (e) {
          logger.error(`Error reading output file for ${scannerName}:`, e);
        }
      } else {
        safeSend(sender, 'scan:output', { scanId, scanner: scannerName, type: 'stderr', message: `\n[SYSTEM] Tool finished but no output file was generated.` });
      }

      // Attempt to parse findings if they exist
      this.parseAndSendFindings(context, adapter);

      // Clean up interval if this was the last active process for the scan
      const scanSession = this.activeScans.get(scanId);
      let allDone = true;
      if (scanSession) {
         for (const proc of Object.values(scanSession)) {
           if (proc.exitCode === null && !proc.killed) {
             allDone = false; break;
           }
         }
      }
      if (allDone) {
         const interval = this.statEmitIntervals.get(scanId);
         if (interval) { clearInterval(interval); this.statEmitIntervals.delete(scanId); }
      }

      storage.updateStatus(scanId, scannerName, code === 0 ? 'COMPLETED' : 'FAILED');
      safeSend(sender, 'scan:status', { scanId, scanner: scannerName, status: code === 0 ? 'COMPLETED' : 'FAILED', code });
    });

    processInstance.on('error', (err) => {
      logger.error(`${scannerName} process error for ${scanId}`, err);
      storage.updateStatus(scanId, scannerName, 'FAILED');
      safeSend(sender, 'scan:status', { scanId, scanner: scannerName, status: 'FAILED', error: err.message });
    });
  }

  async stopScan(scanId: string) {
    const processes = this.activeScans.get(scanId);
    if (processes) {
      for (const proc of Object.values(processes)) {
        this.killProcess(proc);
      }
      this.activeScans.delete(scanId);
      const interval = this.statEmitIntervals.get(scanId);
      if (interval) { clearInterval(interval); this.statEmitIntervals.delete(scanId); }
      storage.updateStatus(scanId, null, 'STOPPED');
      logger.info(`Scan ${scanId} stopped by user`);
      return { success: true };
    }
    return { success: false, error: 'Scan not found' };
  }

  private parseAndSendFindings(context: any, adapter: any) {
    if (adapter.parseFindings) {
      try {
        const findings = adapter.parseFindings(context);
        if (findings && findings.length > 0) {
          safeSend(context.sender, 'scan:findings', { scanId: context.scanId, scanner: context.scannerName, findings });
        }
      } catch (e: any) {
        logger.error(`Error parsing findings for ${context.scannerName}: ${e.message}`, e);
      }
    }
  }

  /** Kill all running scans — called on app quit */
  killAll() {
    for (const [scanId, processes] of this.activeScans) {
      for (const proc of Object.values(processes)) {
        this.killProcess(proc);
      }
      logger.info(`Killed processes for scan ${scanId} (app quit)`);
    }
    this.activeScans.clear();
    for (const interval of this.statEmitIntervals.values()) clearInterval(interval);
    this.statEmitIntervals.clear();
  }

  /** Platform-safe process kill (Windows needs taskkill for tree-kill) */
  private killProcess(proc?: ChildProcess) {
    if (!proc || proc.killed) return;
    try {
      if (process.platform === 'win32' && proc.pid) {
        // taskkill /F /T kills the entire process tree on Windows
        execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
      } else {
        proc.kill('SIGTERM');
      }
    } catch {
      // Process may have already exited — safe to ignore
    }
  }
}
