import { spawn, ChildProcess, execSync } from 'child_process';
import { logger, LoggerService } from './logger';
import { storage } from './storage';
import { settingsStore } from './settings';
import { dependencyService } from './dependencyManager';
import { toolManager } from './toolManager';
import { dbService } from './database';
import path from 'path';
import { getAdapter } from './scanners/registry';
import type { ScannerContext, IScannerAdapter } from './scanners/types';
import fs from 'fs';
import os from 'os';
import { toolCatalog } from './catalog';
import { ScanStateMachine } from './runner/stateMachine';
import { activeRuntime, isActiveValidationTool, validateActiveConfig } from './scanners/activeValidation';
import { endpointInventory, DISCOVERY_TOOLS } from './endpointInventory';
import { resolveTarget, validateToolsForTarget } from './target/targetValidator';
import { ScopeEnforcer, type EngagementScope } from './workspace/scopeEnforcement';
import { authService } from './workspace/authService';
import { ProvenanceTracker, type InputProvenance } from './workspace/provenance';
import { processLock } from './platform/processLock';
import { containerLifecycle } from './platform/containerLifecycle';

/** Safely send IPC to renderer — no-op if the window was already closed */
function safeSend(sender: Electron.WebContents, channel: string, data: unknown) {
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

/** Execution priority mapping for phased pipeline scan mode */
export const TOOL_PIPELINE_PRIORITY: Record<string, number> = {
  // Phase 1: Passive Recon, DNS, Network & Port Profiling
  subfinder: 10,
  alterx: 11,
  dnsx: 12,
  wafw00f: 13,
  whatweb: 14,
  cmseek: 15,
  naabu: 16,
  nmap: 17,
  tlsx: 18,
  sslyze: 19,
  testssl: 20,
  gitleaks: 21,
  semgrep: 22,
  trivy: 23,

  // Phase 2: Active Web Crawling & Endpoint Discovery
  httpx: 30,
  katana: 31,
  gau: 32,
  ffuf: 33,

  // Phase 3: Parameter Discovery & Fuzzing
  arjun: 40,
  crlfsuite: 41,
  corsy: 42,
  schemathesis: 43,

  // Phase 4: Deep DAST & Vulnerability Auditing
  nuclei: 50,
  wapiti: 51,
  dalfox: 52,
  zap: 53,
  wpscan: 54,
  nikto: 55,
  sqlmap: 59,
  commix: 60,
  appscan: 56,
  netsparker: 57,
  acunetix: 58,
};

export class ScannerService {
  private activeScans: Map<string, { [scanner: string]: ChildProcess }> = new Map();
  private scanRemainingTools: Map<string, Set<string>> = new Map();
  private scanStats: Map<string, Record<string, Record<string, number>>> = new Map();
  private statEmitIntervals: Map<string, NodeJS.Timeout> = new Map();
  private stoppedScans: Set<string> = new Set();

  /** Check if a CLI tool is available on PATH or via toolManager */
  async checkTool(name: string): Promise<{ available: boolean; version?: string; resolvedPath?: string }> {
    try {
      if (path.isAbsolute(name) && fs.existsSync(name)) {
        return { available: true, resolvedPath: name };
      }

      if (name === 'docker') {
        const cmd = process.platform === 'win32' ? 'where docker' : 'which docker';
        const output = execSync(cmd, { stdio: 'pipe' }).toString().trim();
        return { available: true, resolvedPath: output.split('\n')[0].trim() };
      }

      // Try toolManager resolution first
      const toolBaseName = path.basename(name).replace(/\.exe$/i, '').replace(/\.bat$/i, '').replace(/\.cmd$/i, '');
      const resolved = toolManager.resolveToolPath(toolBaseName);
      if (resolved && fs.existsSync(resolved)) {
        return { available: true, resolvedPath: resolved };
      }

      const cmd = process.platform === 'win32' ? `where ${toolBaseName}` : `which ${toolBaseName}`;
      const output = execSync(cmd, { stdio: 'pipe' }).toString().trim();
      const firstPath = output.split('\n')[0].trim();
      return { available: true, resolvedPath: firstPath };
    } catch {
      // Windows fallbacks
      if (process.platform === 'win32') {
        const toolBaseName = path.basename(name).replace(/\.exe$/i, '').replace(/\.bat$/i, '');
        if (toolBaseName === 'nmap') {
          const fallbacks = [
            'C:\\Program Files (x86)\\Nmap\\nmap.exe',
            'C:\\Program Files\\Nmap\\nmap.exe'
          ];
          for (const p of fallbacks) {
            if (fs.existsSync(p)) return { available: true, resolvedPath: p };
          }
        }
      }
      return { available: false };
    }
  }

  async startScan(sender: Electron.WebContents, targetUrl: string, config: Record<string, unknown>) {
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
      const requestedTools = Array.isArray(config.tools)
        ? [...new Set(config.tools as string[])]
        : ['nuclei', 'wapiti'];

      if (requestedTools.length === 0) {
        return { success: false, error: 'No tools selected for scanning. Please select at least one scanner engine.' };
      }
      if (requestedTools.some(t => typeof t !== 'string' || !toolCatalog.get(t))) throw new Error('Unknown scanner requested.');

      // Typed target union & tool capability validation
      const resolvedTarget = resolveTarget(targetUrl);
      const targetValidation = validateToolsForTarget(resolvedTarget, requestedTools);
      if (!targetValidation.valid) {
        return {
          success: false,
          error: targetValidation.rejectedTools.map(t => t.reason).join('\n')
        };
      }

      // Engagement scope enforcement
      if (config.scope && typeof config.scope === 'object') {
        const scopeEval = ScopeEnforcer.isUrlInScope(targetUrl, config.scope as EngagementScope);
        if (!scopeEval.inScope) {
          return {
            success: false,
            error: `Target URL is outside authorized engagement scope: ${scopeEval.reason}`
          };
        }
      }

      // Authentication session health validation
      if (config.authProfileId && typeof config.authProfileId === 'string') {
        const profile = authService.getProfile(config.authProfileId);
        if (!profile) {
          return {
            success: false,
            error: `Authentication profile '${config.authProfileId}' not found.`
          };
        }
        try {
          const authLaunch = await authService.validateSessionForLaunch(profile);
          config.resolvedAuthHeader = authLaunch.resolvedHeader;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            error: `Authentication check failed: ${msg}`
          };
        }
      }

      endpointInventory.validateLaunch(targetUrl,config);
      const activeTools = requestedTools.filter(isActiveValidationTool);
      const activeRuntimes: Record<string, ReturnType<typeof activeRuntime>> = {};
      if (activeTools.length) {
        config = { ...config, activeValidation: validateActiveConfig(targetUrl, config.activeValidation, activeTools) };
        for (const tool of activeTools) activeRuntimes[tool] = activeRuntime(tool, settings as unknown as Record<string, unknown>);
        config.activeRuntimes = activeRuntimes;
      }

      // Mapping of tool names to their configured binaries using toolCatalog & toolManager resolution
      const toolBinaries: Record<string, string> = {};
      for (const t of requestedTools) {
        if (isActiveValidationTool(t)) {
          toolBinaries[t] = activeRuntimes[t].executable;
        } else if (t === 'acunetix') {
          toolBinaries[t] = process.execPath;
        } else if (t === 'appscan') {
          toolBinaries[t] = (settings.appscanPath as string) || 'C:\\Program Files (x86)\\HCL\\AppScan Standard\\AppScanCMD.exe';
        } else if (t === 'netsparker') {
          toolBinaries[t] = (settings.netsparkerPath as string) || path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Invicti Professional Edition', 'Netsparker.exe');
        } else if (t === 'wpscan') {
          toolBinaries[t] = 'docker';
        } else {
          const resolved = toolManager.resolveToolPath(t);
          if (resolved) {
            toolBinaries[t] = resolved;
          } else {
            const manifest = toolCatalog.get(t);
            if (manifest) {
              if (manifest.installStrategy.type === 'system-manual' && manifest.installStrategy.defaultPaths) {
                const found = manifest.installStrategy.defaultPaths.find(p => fs.existsSync(p));
                toolBinaries[t] = found || manifest.installStrategy.exeName;
              } else {
                toolBinaries[t] = manifest.installStrategy.exeName;
              }
            }
          }
        }
      }

      const toolsToRun = requestedTools.filter((t: string) => toolBinaries[t]);
      if (toolsToRun.length === 0) {
        return { success: false, error: 'None of the requested tools are recognized or configured.' };
      }

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
      
      const lockRes = processLock.acquireLocks(scanId, toolsToRun);
      if (!lockRes.success) {
        return {
          success: false,
          error: `Cannot start scan: tool '${lockRes.conflictedTool}' is currently locked by another active scan.`
        };
      }
      await storage.saveMetadata(scanId, {
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

      const executionMode = config.executionMode === 'concurrent' ? 'concurrent' : 'pipeline';
      const orderedTools = executionMode === 'pipeline'
        ? [...toolsToRun].sort((a, b) => (TOOL_PIPELINE_PRIORITY[a] ?? 99) - (TOOL_PIPELINE_PRIORITY[b] ?? 99))
        : toolsToRun;

      this.scanRemainingTools.set(scanId, new Set(orderedTools));

      // Start requested tools
      if (executionMode === 'concurrent') {
        for (const tool of orderedTools) {
          const outDir = tool === 'nuclei' ? nucleiDir : tool === 'wapiti' ? wapitiDir : scanDir;
          this.runGenericTool(sender, scanId, targetUrl, domain, tool, toolBinaries[tool], outDir, config);
        }
      } else {
        // Mode Bertahap (Phased Pipeline): execute orderly per phase to avoid network choking & WAF bans
        (async () => {
          for (const tool of orderedTools) {
            if (this.stoppedScans.has(scanId)) break;
            const outDir = tool === 'nuclei' ? nucleiDir : tool === 'wapiti' ? wapitiDir : scanDir;
            await this.runGenericTool(sender, scanId, targetUrl, domain, tool, toolBinaries[tool], outDir, config);
          }
        })().catch(err => {
          logger.error(`Error in phased pipeline scan for ${scanId}:`, err);
        });
      }

      return { success: true, scanId };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start scan', errorMessage);
      return { success: false, error: errorMessage };
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
    config?: Record<string, unknown>
  ): Promise<void> {
    return new Promise((resolve) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const outputFile = path.join(outDir, `${scannerName}_${domain}_${timestamp}.txt`);
    const jsonFile = path.join(outDir, `${scannerName}_${domain}_${timestamp}.json`);
    const xmlFile = path.join(outDir, `${scannerName}_${domain}_${timestamp}.xml`);

    const adapter = getAdapter(scannerName);
    const context: ScannerContext = {
      scanId, targetUrl, domain, scannerName, bin, outDir, config,
      timestamp, outputFile, jsonFile, xmlFile, sender,
      settings: settingsStore.get()
    };

    let processInstance: ChildProcess;
    let executable = bin;
    let spawnArgs: string[];
    try {
    const args = adapter.getCommandArgs(context);
    
    let env = { ...process.env };
    if (adapter.getEnv) {
      env = adapter.getEnv(context, env);
    }
    
    let useShell = false;
    let cwd = outDir;
    spawnArgs = args;

    const isBat = bin.toLowerCase().endsWith('.bat') || bin.toLowerCase().endsWith('.cmd');
    if (isBat && process.platform === 'win32') {
      executable = process.env.comspec || 'cmd.exe';
      spawnArgs = ['/c', bin, ...args];
      cwd = outDir;
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

      processInstance = spawn(executable, spawnArgs, { 
        env, 
        cwd, 
        shell: useShell,
        windowsHide: true,
        windowsVerbatimArguments: false 
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`Failed to spawn ${scannerName}:`, error);
      safeSend(sender, 'scan:output', { 
        scanId, 
        scanner: scannerName, 
        type: 'stderr', 
        message: `[SYSTEM ERROR] Failed to spawn process: ${error.message}\nPlease check permissions or if your antivirus is blocking ${executable}.` 
      });
      storage.updateStatus(scanId, scannerName, 'FAILED');
      safeSend(sender, 'scan:status', { scanId, scanner: scannerName, status: 'FAILED' });
      const remaining = this.scanRemainingTools.get(scanId);
      if (remaining) remaining.delete(scannerName);
      if (!remaining?.size) {
        const interval = this.statEmitIntervals.get(scanId);
        if (interval) clearInterval(interval);
        this.statEmitIntervals.delete(scanId);
        this.activeScans.delete(scanId);
        this.scanRemainingTools.delete(scanId);
        this.scanStats.delete(scanId);
      }
      resolve();
      return;
    }
    
    if (processInstance.stdin && adapter.handleStdin) {
      adapter.handleStdin(context, processInstance);
    }
    if (processInstance.stdin && !processInstance.stdin.writableEnded) {
      processInstance.stdin.end();
    }

    safeSend(sender, 'scan:status', { scanId, scanner: scannerName, status: 'RUNNING' });
    void storage.updateStatus(scanId, scannerName, 'RUNNING');
    const scanSession = this.activeScans.get(scanId);
    if (scanSession) scanSession[scannerName] = processInstance;

    if (executable.toLowerCase().includes('docker') || spawnArgs.some(a => typeof a === 'string' && a.toLowerCase().includes('docker'))) {
      const nameIdx = spawnArgs.indexOf('--name');
      if (nameIdx !== -1 && nameIdx + 1 < spawnArgs.length) {
        containerLifecycle.registerContainer(scanId, String(spawnArgs[nameIdx + 1]));
      }
    }

    let finalized = false;

    processInstance.stdout?.on('data', (data) => {
      const msg = LoggerService.redactSensitive(data.toString());
      stdoutBatcher.send(sender, scanId, scannerName, 'stdout', msg);
      try {
        fs.appendFileSync(outputFile, msg);
      } catch { /* ignore */ }
      
      const stats = this.scanStats.get(scanId);
      if (stats && adapter.processStdout) {
        adapter.processStdout(context, msg, stats);
      }
    });

    processInstance.stderr?.on('data', (data) => {
      const msg = LoggerService.redactSensitive(data.toString());
      stderrBatcher.send(sender, scanId, scannerName, 'stderr', msg);
      if (isActiveValidationTool(scannerName)) {
        try { fs.appendFileSync(outputFile, msg); } catch { /* parser fails if output unavailable */ }
      }
    });

    // Per-tool execution timeout safeguard
    let timedOut = false;
    const timeoutMs = isActiveValidationTool(scannerName)
      ? validateActiveConfig(targetUrl, config?.activeValidation, [scannerName]).timeoutMinutes * 60_000
      : (typeof config?.timeoutMinutes === 'number' && config.timeoutMinutes > 0)
      ? config.timeoutMinutes * 60 * 1000
      : toolCatalog.getTimeout(scannerName);
    const timeoutTimer = setTimeout(() => {
      if (processInstance.exitCode === null && !processInstance.killed) {
        timedOut = true;
        logger.warn(`Scanner ${scannerName} for ${scanId} exceeded timeout (${timeoutMs}ms). Terminating process.`);
        safeSend(sender, 'scan:output', { scanId, scanner: scannerName, type: 'stderr', message: `\n[SYSTEM TIMEOUT] Scanner ${scannerName} exceeded timeout limit and was terminated.` });
        this.killProcess(processInstance);
      }
    }, timeoutMs);
    processInstance.once('close', () => clearTimeout(timeoutTimer));

    const finalize = async (finalStatus: string, code?: number | null) => {
      if (finalized) return;
      finalized = true;

      // Await persistence before emitting success/completion event
      await storage.updateStatus(scanId, scannerName, finalStatus);
      safeSend(sender, 'scan:status', { scanId, scanner: scannerName, status: finalStatus, code });

      const remaining = this.scanRemainingTools.get(scanId);
      if (remaining) remaining.delete(scannerName);

      const scanSession = this.activeScans.get(scanId);
      let anyProcRunning = false;
      if (scanSession) {
        for (const proc of Object.values(scanSession)) {
          if (proc === processInstance) continue;
          if (proc.exitCode === null && !proc.killed) {
            anyProcRunning = true; break;
          }
        }
      }
      const allDone = ((!remaining || remaining.size === 0) && !anyProcRunning) || this.stoppedScans.has(scanId);

      if (allDone) {
        processLock.releaseLocks(scanId);
        void containerLifecycle.cleanupContainers(scanId);
        const interval = this.statEmitIntervals.get(scanId);
        if (interval) { clearInterval(interval); this.statEmitIntervals.delete(scanId); }
        this.activeScans.delete(scanId);
        this.scanRemainingTools.delete(scanId);
        this.scanStats.delete(scanId);
        setTimeout(() => this.stoppedScans.delete(scanId), 10000);
      }
      resolve();
    };

    processInstance.on('error', (err) => {
      logger.error(`Failed to start ${scannerName}:`, err);
      safeSend(sender, 'scan:output', { scanId, scanner: scannerName, type: 'stderr', message: `[SYSTEM ERROR] Process error: ${err.message}\nPlease check if the tool is installed and executable.` });
      const finalStatus = this.stoppedScans.has(scanId) ? 'STOPPED' : 'FAILED';
      void finalize(finalStatus, -1);
    });

    // Listen to 'close' to ensure stdio streams are fully drained and buffers flushed
    processInstance.on('close', async (code) => {
      logger.info(`${scannerName} process for ${scanId} closed with code ${code}`);
      
      const fileToRead = ['alterx', 'nmap', 'sqlmap'].includes(scannerName) ? outputFile : 
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
      const parsed = this.parseAndSendFindings(context, adapter);

      const wasCancelled = this.stoppedScans.has(scanId) || processInstance.killed || Boolean((processInstance as unknown as { _wasTerminated?: boolean })._wasTerminated);
      const exitSemantic = toolCatalog.getExitCodeSemantic(scannerName, code);
      const isSuccess = adapter.isSuccessExitCode 
        ? adapter.isSuccessExitCode(code, context) 
        : (exitSemantic === 'clean' || exitSemantic === 'findings_found');
      const finalStatus = timedOut ? 'FAILED' : wasCancelled ? 'STOPPED' : isSuccess && parsed ? 'COMPLETED' : 'FAILED';
      await finalize(finalStatus, code);
    });
  });
}

  async stopScan(scanId: string) {
    this.stoppedScans.add(scanId);
    const processes = this.activeScans.get(scanId);
    const remaining = this.scanRemainingTools.get(scanId);
    if (remaining) {
      for (const tool of remaining) {
        storage.updateStatus(scanId, tool, 'STOPPED');
      }
      this.scanRemainingTools.delete(scanId);
    }
    if (processes) {
      for (const proc of Object.values(processes)) {
        this.killProcess(proc);
      }
      const interval = this.statEmitIntervals.get(scanId);
      if (interval) { clearInterval(interval); this.statEmitIntervals.delete(scanId); }
      storage.updateStatus(scanId, null, 'STOPPED');
      processLock.releaseLocks(scanId);
      void containerLifecycle.cleanupContainers(scanId);
      logger.info(`Scan ${scanId} stopped by user`);
      return { success: true };
    }
    processLock.releaseLocks(scanId);
    void containerLifecycle.cleanupContainers(scanId);
    return { success: false, error: 'Scan not found' };
  }

  private parseAndSendFindings(context: ScannerContext, adapter: IScannerAdapter) {
    if (adapter.parseFindings) {
      try {
        if (DISCOVERY_TOOLS.includes(context.scannerName)) {
          const count = endpointInventory.capture(context);
          safeSend(context.sender, 'scan:output', {scanId:context.scanId,scanner:context.scannerName,type:'stdout',message:`[INVENTORY] ${count} endpoint observations imported. Open Endpoint Inventory to review and test.\n`});
          return true;
        }
        const findings = adapter.parseFindings(context);
        if (findings && findings.length > 0) {
          const provenance: InputProvenance = {
            sourceScanId: context.scanId,
            endpointId: (context.config?.workflow as any)?.endpointId,
            discoveredByTools: [context.scannerName],
            requestMethod: (context.config?.requestDefinition as any)?.method || 'GET',
            requestUrl: context.targetUrl,
            parameterTested: (context.config?.activeValidation as any)?.parameters?.[0],
            scannerEngine: context.scannerName,
            timestamp: new Date().toISOString()
          };
          const findingsWithProv = findings.map(f =>
            ProvenanceTracker.attachFindingProvenance(f as Record<string, unknown>, provenance)
          );
          try {
            dbService.insertFindings(context.scanId, context.scannerName, findingsWithProv);
          } catch(e) {
            logger.error(`Error inserting findings to DB for ${context.scannerName}`, e);
            return false;
          }
          
          // Chunk IPC sends to prevent renderer UI freezing
          const CHUNK_SIZE = 50;
          for (let i = 0; i < findings.length; i += CHUNK_SIZE) {
            const chunk = findings.slice(i, i + CHUNK_SIZE);
            safeSend(context.sender, 'scan:findings', { scanId: context.scanId, scanner: context.scannerName, findings: chunk });
          }
        }
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        logger.error(`Error parsing findings for ${context.scannerName}: ${errMsg}`, e);
        safeSend(context.sender, 'scan:output', { scanId: context.scanId, scanner: context.scannerName, type: 'stderr', message: `[RESULT ERROR] ${errMsg}\n` });
        return false;
      }
    }
    return true;
  }

  /** Kill all running scans — called on app quit */
  killAll() {
    for (const [scanId, processes] of this.activeScans) {
      this.stoppedScans.add(scanId);
      for (const proc of Object.values(processes)) {
        this.killProcess(proc);
      }
      logger.info(`Killed processes for scan ${scanId} (app quit)`);
    }
    this.activeScans.clear();
    for (const interval of this.statEmitIntervals.values()) clearInterval(interval);
    this.statEmitIntervals.clear();
    processLock.clearAll();
    void containerLifecycle.cleanupAll();
  }

  /** Platform-safe process kill (Windows needs taskkill for tree-kill) */
  private killProcess(proc?: ChildProcess) {
    if (!proc || proc.killed) return;
    try {
      (proc as unknown as { _wasTerminated?: boolean })._wasTerminated = true;
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

export const scannerService = new ScannerService();

