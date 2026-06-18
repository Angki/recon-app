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

    let args: string[] = [];
    
    // Check if wordpress scan is requested
    const isWordpress = config?.isWordpress;
    
    // Configure arguments based on the tool
    switch(scannerName) {
      case 'nuclei':
        // -je outputs JSON export to a file, keeping stdout human-readable
        let nucleiArgs = ['-u', targetUrl, '-severity', 'info,low,medium,high,critical', '-stats', '-duc', '-ni', '-v', '-o', outputFile, '-je', jsonFile];
        if (isWordpress) {
          nucleiArgs.splice(2, 0, '-tags', 'wordpress,wp-plugin,wp-theme');
        }
        if (settingsStore.get().nucleiTemplatesPath) {
          nucleiArgs.push('-t', settingsStore.get().nucleiTemplatesPath as string);
        }
        args = nucleiArgs;
        break;
      case 'wapiti':
        args = ['-u', targetUrl, '-l', '2', '-v', '2', '-f', 'json', '-dr', '2', '-o', jsonFile];
        break;
      case 'subfinder':
        args = ['-d', domain, '-json', '-o', jsonFile];
        break;
      case 'alterx':
        args = ['-o', outputFile]; // Domain will be sent via stdin
        break;
      case 'dnsx':
        args = ['-json', '-o', jsonFile]; // Domain will be sent via stdin
        break;
      case 'naabu':
        args = ['-host', domain, '-top-ports', '100', '-json', '-o', jsonFile];
        break;
      case 'tlsx':
        args = ['-u', domain, '-json', '-o', jsonFile];
        break;
      case 'httpx':
        args = ['-u', targetUrl, '-title', '-tech-detect', '-status-code', '-json', '-o', jsonFile];
        break;
      case 'nmap':
        args = ['-sV', '-sC', domain, '-oN', outputFile];
        break;
      case 'zap':
        const zapHome = path.join(outDir, `zap_home_${timestamp}`);
        if (!fs.existsSync(zapHome)) fs.mkdirSync(zapHome, { recursive: true });
        args = ['-cmd', '-quickurl', targetUrl, '-quickout', jsonFile, '-quickprogress', '-dir', zapHome];
        break;
      case 'wpscan':
        // Docker volume mapping for output
        args = [
          'run', '--rm', 
          '-v', `${outDir}:/mnt`, 
          'wpscanteam/wpscan', 
          '--url', targetUrl, 
          '-f', 'cli-no-color',
          '-f', 'json', 
          '-o', `/mnt/${path.basename(jsonFile)}`,
          '--random-user-agent',
          '--force',
          '--disable-tls-checks'
        ];
        if (settingsStore.get().wpscanApiToken) {
          args.push('--api-token', settingsStore.get().wpscanApiToken as string);
        }
        break;
      case 'katana':
        args = ['-u', targetUrl, '-j', '-o', jsonFile];
        break;
      case 'ffuf':
        const wordlist = settingsStore.get().wordlistPath ? path.resolve(process.cwd(), settingsStore.get().wordlistPath as string) : 'C:\\wordlists\\common.txt';
        if (!fs.existsSync(wordlist)) {
          setTimeout(() => {
            safeSend(sender, 'scan:output', { scanId, scanner: scannerName, type: 'stderr', message: `[ERROR] Wordlist not found at ${wordlist}. Please configure Wordlist Path in Settings.` });
            storage.updateStatus(scanId, scannerName, 'FAILED');
            safeSend(sender, 'scan:status', { scanId, scanner: scannerName, status: 'FAILED' });
          }, 500);
          return;
        }
        args = ['-u', `${targetUrl}/FUZZ`, '-w', wordlist, '-v', '-o', jsonFile, '-of', 'json'];
        break;
      case 'appscan':
        args = ['exec', '/su', targetUrl, '/dest', path.join(outDir, `appscan_${timestamp}.scan`), '/rf', xmlFile, '/rt', 'xml', '/v'];
        break;
      case 'netsparker':
        args = ['/a', '/url', targetUrl, '/r', xmlFile, '/silent'];
        break;
      case 'acunetix':
        const isPackaged = require('electron').app.isPackaged;
        const runnerPath = isPackaged
          ? path.join(process.resourcesPath, 'scripts', 'acunetix_runner.js')
          : path.join(process.cwd(), 'electron', 'scripts', 'acunetix_runner.js');
        const s = settingsStore.get();
        const acunetixUrl = s.acunetixUrl || 'https://127.0.0.1:13443';
        const acunetixProfileId = s.acunetixProfileId || '11111111-1111-1111-1111-111111111111';
        args = [runnerPath, targetUrl, jsonFile, xmlFile, acunetixUrl, '', acunetixProfileId];
        break;
      default:
        args = [targetUrl];
    }

    let env = { ...process.env };
    if (scannerName === 'wapiti') {
      env.PYTHONIOENCODING = 'utf-8';
    } else if (scannerName === 'acunetix') {
      env.ELECTRON_RUN_AS_NODE = '1';
      const s = settingsStore.get();
      if (s.acunetixApiKey) env.ACUNETIX_API_KEY = s.acunetixApiKey;
      if (s.acunetixEmail) env.ACUNETIX_EMAIL = s.acunetixEmail;
      if (s.acunetixPassword) env.ACUNETIX_PASSWORD = s.acunetixPassword;
    }
    const isBat = bin.toLowerCase().endsWith('.bat') || bin.toLowerCase().endsWith('.cmd');
    
    // ZAP needs to run in its own directory on Windows to find its JAR file
    const cwd = scannerName === 'zap' ? path.dirname(bin) : process.cwd();
    
    // To avoid cmd.exe parsing issues with spaces in absolute paths (e.g. C:\Program Files\...)
    // we just use the filename since we are already in that directory for ZAP.
    const executable = (scannerName === 'zap' && isBat) ? path.basename(bin) : bin;
    
    let spawnExecutable = executable;
    let spawnArgs = args;
    let useShell = false;

    if (scannerName === 'netsparker') {
      spawnExecutable = 'powershell.exe';
      const script = `Start-Process -Wait -NoNewWindow -FilePath '${executable}' -ArgumentList ${args.map(a => `'${a.replace(/'/g, "''")}'`).join(', ')}`;
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
      spawnArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript];
    } else if (isBat && process.platform === 'win32') {
      spawnExecutable = process.env.comspec || 'cmd.exe';
      spawnArgs = ['/c', executable, ...args];
      useShell = false;
    } else if (isBat) {
      // Fallback for non-Windows executing .bat (rare, usually via Wine/mono but just in case)
      useShell = true;
    }
    
    // Disable shell execution entirely on Windows unless strictly necessary
    const processInstance = spawn(spawnExecutable, spawnArgs, { 
      env, 
      cwd, 
      shell: useShell,
      windowsVerbatimArguments: false 
    });
    
    if (processInstance.stdin) {
      if (['alterx', 'dnsx'].includes(scannerName)) {
        processInstance.stdin.write(domain + '\n');
      }
      processInstance.stdin.end();
    }

    const scanSession = this.activeScans.get(scanId);
    if (scanSession) scanSession[scannerName] = processInstance;

    processInstance.stdout?.on('data', (data) => {
      const msg = data.toString();
      stdoutBatcher.send(sender, scanId, scannerName, 'stdout', msg);
      
      const stats = this.scanStats.get(scanId);
      if (stats) {
        if (scannerName === 'nuclei') {
          const cleanMsg = msg.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
          const lines = cleanMsg.split('\n');
          for (const line of lines) {
            const sev = line.match(/\[(info|low|medium|high|critical)\]/i);
            if (sev && !line.includes('[WRN]') && !line.includes('[DBG]') && !line.includes('[VER]')) {
              const key = sev[1].toLowerCase() as keyof typeof stats.nuclei;
              stats.nuclei[key]++;
            }
          }
        } else if (scannerName === 'wapiti') {
          const cleanMsg = msg.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
          const urlsMatch = cleanMsg.match(/found (\d+) URLs/);
          if (urlsMatch) {
            stats.wapiti.pages = parseInt(urlsMatch[1]);
          }
          if (cleanMsg.includes('vulnerability found in')) {
            stats.wapiti.vulns++;
          } else {
            const vulnPatterns = [/\[\+\] .*vulnerability found/, /\[!!\]/];
            for (const pat of vulnPatterns) {
              if (pat.test(cleanMsg) && !cleanMsg.includes('vulnerability found in')) {
                stats.wapiti.vulns++;
                break;
              }
            }
          }
        }
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
      this.parseAndSendFindings(sender, scanId, scannerName, jsonFile, outputFile, xmlFile);

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

  private parseAndSendFindings(sender: Electron.WebContents, scanId: string, scannerName: string, jsonFile: string, outputFile: string, xmlFile?: string) {
    if (!fs.existsSync(jsonFile) && !fs.existsSync(outputFile) && (!xmlFile || !fs.existsSync(xmlFile))) return;
    try {
      if (scannerName === 'appscan' && xmlFile && fs.existsSync(xmlFile)) {
        const content = fs.readFileSync(xmlFile, 'utf-8');
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
        const data = parser.parse(content);
        const findings: any[] = [];
        
        // AppScan XML structure usually has XmlReport -> AppScanInfo -> Issues -> Issue
        const issues = data?.XmlReport?.Issues?.Issue || data?.Issues?.Issue || [];
        const issuesArray = Array.isArray(issues) ? issues : [issues];
        
        for (const issue of issuesArray) {
          if (!issue) continue;
          findings.push({
            id: issue['@_IssueTypeID'] || 'appscan-finding',
            name: issue.IssueType?.name || issue['@_IssueType'] || 'AppScan Finding',
            severity: issue['@_Severity']?.toLowerCase() || 'medium',
            scanner: 'appscan',
            url: issue.Entity?.name || issue['@_Url'] || '',
            description: issue.Variant?.[0]?.Difference || issue.Difference || '',
            timestamp: new Date().toISOString(),
          });
        }
        safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
      } else if (scannerName === 'netsparker' && xmlFile && fs.existsSync(xmlFile)) {
        const content = fs.readFileSync(xmlFile, 'utf-8');
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
        const data = parser.parse(content);
        const findings: any[] = [];
        
        // Netsparker XML structure usually has vulnerabilities -> vulnerability
        const vulns = data?.netsparker?.vulnerabilities?.vulnerability || data?.vulnerabilities?.vulnerability || [];
        const vulnsArray = Array.isArray(vulns) ? vulns : [vulns];
        
        for (const vuln of vulnsArray) {
          if (!vuln) continue;
          findings.push({
            id: vuln.type || 'netsparker-finding',
            name: vuln.name || 'Netsparker Finding',
            severity: vuln.severity?.toLowerCase() || 'medium',
            scanner: 'netsparker',
            url: vuln.url || '',
            description: vuln.description || '',
            timestamp: new Date().toISOString(),
          });
        }
        safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
      } else if (scannerName === 'acunetix') {
        const content = fs.readFileSync(jsonFile, 'utf-8');
        const vulns = JSON.parse(content);
        const findings: any[] = [];
        for (const vuln of vulns) {
          if (!vuln) continue;
          let severity = 'info';
          if (vuln.severity === 3) severity = 'high';
          else if (vuln.severity === 2) severity = 'medium';
          else if (vuln.severity === 1) severity = 'low';

          findings.push({
            id: vuln.vt_id || vuln.vuln_id || 'acunetix-finding',
            name: vuln.vt_name || 'Acunetix Finding',
            severity: severity,
            scanner: 'acunetix',
            url: vuln.affects_url || vuln.affects_detail || '',
            description: vuln.tags ? vuln.tags.join(', ') : '',
            timestamp: new Date().toISOString(),
          });
        }
        safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
      } else if (scannerName === 'nuclei') {
        // Nuclei output is line-delimited JSON
        const content = fs.readFileSync(jsonFile, 'utf-8');
        const findings: any[] = [];
        const lines = content.split('\n').filter(l => l.trim() !== '');
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            findings.push({
              id: data['template-id'] || 'nuclei-finding',
              name: data.info?.name || 'Unknown',
              severity: data.info?.severity || 'info',
              scanner: 'nuclei',
              url: data['matched-at'] || data.host || '',
              description: data.info?.description || '',
              timestamp: data.timestamp || new Date().toISOString(),
            });
          } catch (e) { /* ignore parse error for a single line */ }
        }
        safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
      } else if (scannerName === 'wapiti') {
        // Wapiti output is a single JSON object
        const content = fs.readFileSync(jsonFile, 'utf-8');
        const data = JSON.parse(content);
        const findings: any[] = [];
        
        if (data.vulnerabilities) {
          for (const [vulnType, vulns] of Object.entries(data.vulnerabilities)) {
            const vulnArray = vulns as any[];
            for (const v of vulnArray) {
              findings.push({
                id: vulnType,
                name: vulnType,
                severity: v.level === 1 ? 'low' : v.level === 2 ? 'medium' : 'high', // Wapiti levels: 1, 2, 3
                scanner: 'wapiti',
                url: v.path || '',
                description: v.info || '',
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
        safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
      } else if (['naabu', 'dnsx', 'tlsx', 'subfinder', 'httpx'].includes(scannerName)) {
        if (!fs.existsSync(jsonFile)) return;
        const content = fs.readFileSync(jsonFile, 'utf-8');
        const findings: any[] = [];
        const lines = content.split('\n').filter(l => l.trim() !== '');
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            findings.push({
              id: `${scannerName}-finding`,
              name: data.host || data.url || data.title || 'Discovered Item',
              severity: 'info',
              scanner: scannerName,
              url: data.url || data.host || '',
              description: JSON.stringify(data),
              timestamp: data.timestamp || new Date().toISOString(),
            });
          } catch (e) {}
        }
        if (findings.length > 0) safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
      } else if (scannerName === 'nmap' && fs.existsSync(outputFile)) {
        const content = fs.readFileSync(outputFile, 'utf-8');
        const openPorts = content.split('\n').filter(l => l.includes(' open '));
        if (openPorts.length > 0) {
          safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings: [{
            id: 'nmap-open-ports',
            name: 'Nmap Open Ports',
            severity: 'medium',
            scanner: 'nmap',
            url: '',
            description: openPorts.join('\n'),
            timestamp: new Date().toISOString(),
          }] });
        }
      } else if (scannerName === 'alterx' && fs.existsSync(outputFile)) {
        const content = fs.readFileSync(outputFile, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() !== '');
        if (lines.length > 0) {
          safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings: [{
            id: 'alterx-findings',
            name: 'Alterx Permutations',
            severity: 'info',
            scanner: 'alterx',
            url: '',
            description: `Generated ${lines.length} domain permutations.`,
            timestamp: new Date().toISOString(),
          }] });
        }
      } else if (scannerName === 'wpscan' && fs.existsSync(jsonFile)) {
        const content = fs.readFileSync(jsonFile, 'utf-8');
        try {
          const data = JSON.parse(content);
          const findings: any[] = [];
          
          if (data.interesting_findings) {
            data.interesting_findings.forEach((f: any) => {
              findings.push({
                id: f.type || 'wpscan-interesting',
                name: f.to_s || 'Interesting Finding',
                severity: 'info',
                scanner: 'wpscan',
                url: f.url || '',
                description: f.interesting_entries?.join('\n') || '',
                timestamp: new Date().toISOString(),
              });
            });
          }
          if (data.vulns) {
            data.vulns.forEach((v: any) => {
              findings.push({
                id: v.title || 'wpscan-vuln',
                name: v.title || 'WPScan Vulnerability',
                severity: 'high',
                scanner: 'wpscan',
                url: '',
                description: v.references?.url?.join('\n') || '',
                timestamp: new Date().toISOString(),
              });
            });
          }
          if (findings.length > 0) safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
        } catch (e) {
          logger.error('Failed to parse WPScan JSON:', e);
        }
      } else if (scannerName === 'zap') {
        const content = fs.readFileSync(jsonFile, 'utf-8');
        const data = JSON.parse(content);
        const findings: any[] = [];
        const site = data?.site?.[0];
        if (site && site.alerts) {
          for (const alert of site.alerts) {
            findings.push({
              id: alert.pluginid || 'zap-alert',
              name: alert.name || 'ZAP Finding',
              severity: alert.riskdesc?.toLowerCase().includes('high') ? 'high' : 
                        alert.riskdesc?.toLowerCase().includes('medium') ? 'medium' :
                        alert.riskdesc?.toLowerCase().includes('low') ? 'low' : 'info',
              scanner: 'zap',
              url: alert.instances?.[0]?.uri || site['@name'] || '',
              description: alert.desc || '',
              timestamp: new Date().toISOString(),
            });
          }
        }
        safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
      } else if (scannerName === 'katana') {
        const content = fs.readFileSync(jsonFile, 'utf-8');
        const findings: any[] = [];
        const lines = content.split('\n').filter(l => l.trim() !== '');
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            findings.push({
              id: 'katana-endpoint',
              name: 'Endpoint Discovered',
              severity: 'info',
              scanner: 'katana',
              url: data.request?.endpoint || data.url || '',
              description: `Method: ${data.request?.method || 'GET'}`,
              timestamp: data.timestamp || new Date().toISOString(),
            });
          } catch (e) {}
        }
        safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
      } else if (scannerName === 'ffuf') {
        const content = fs.readFileSync(jsonFile, 'utf-8');
        const data = JSON.parse(content);
        const findings: any[] = [];
        if (data.results) {
          for (const res of data.results) {
            findings.push({
              id: 'ffuf-directory',
              name: 'Hidden Path Discovered',
              severity: 'info',
              scanner: 'ffuf',
              url: res.url || '',
              description: `Status: ${res.status}, Length: ${res.length}, Words: ${res.words}`,
              timestamp: new Date().toISOString(),
            });
          }
        }
        safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
      } else if (scannerName === 'wpscan' && fs.existsSync(jsonFile)) {
        const content = fs.readFileSync(jsonFile, 'utf-8');
        const data = JSON.parse(content);
        const findings: any[] = [];
        
        if (data.scan_aborted) {
          findings.push({
            id: 'wpscan-aborted',
            name: 'Scan Aborted',
            severity: 'info',
            scanner: 'wpscan',
            url: data.target_url || '',
            description: data.scan_aborted,
            timestamp: new Date().toISOString()
          });
        }
        
        if (data.interesting_findings) {
          data.interesting_findings.forEach((finding: any) => {
            findings.push({
              id: 'wpscan-finding',
              name: finding.type || finding.to_s || 'Interesting Finding',
              severity: 'info',
              scanner: 'wpscan',
              url: finding.url || '',
              description: finding.to_s || '',
              timestamp: new Date().toISOString()
            });
          });
        }
        
        if (data.version && data.version.vulnerabilities) {
          data.version.vulnerabilities.forEach((v: any) => {
            findings.push({
              id: v.id || 'wpscan-vuln',
              name: v.title || 'WP Core Vulnerability',
              severity: 'high',
              scanner: 'wpscan',
              url: '',
              description: v.title || '',
              timestamp: new Date().toISOString()
            });
          });
        }
        
        if (data.plugins) {
          for (const [pluginName, pluginData] of Object.entries(data.plugins) as any) {
            if (pluginData.vulnerabilities) {
              pluginData.vulnerabilities.forEach((v: any) => {
                findings.push({
                  id: v.id || `wpscan-plugin-${pluginName}`,
                  name: `Plugin Vuln: ${pluginName}`,
                  severity: 'medium',
                  scanner: 'wpscan',
                  url: pluginData.location || '',
                  description: v.title || '',
                  timestamp: new Date().toISOString()
                });
              });
            }
          }
        }
        
        if (data.themes) {
          for (const [themeName, themeData] of Object.entries(data.themes) as any) {
            if (themeData.vulnerabilities) {
              themeData.vulnerabilities.forEach((v: any) => {
                findings.push({
                  id: v.id || `wpscan-theme-${themeName}`,
                  name: `Theme Vuln: ${themeName}`,
                  severity: 'medium',
                  scanner: 'wpscan',
                  url: themeData.location || '',
                  description: v.title || '',
                  timestamp: new Date().toISOString()
                });
              });
            }
          }
        }

        if (findings.length > 0) {
          safeSend(sender, 'scan:findings', { scanId, scanner: scannerName, findings });
        }
      }
    } catch (e: any) {
      logger.error(`Error parsing findings for ${scannerName}: ${e.message}`, e);
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
