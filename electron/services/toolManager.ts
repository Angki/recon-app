import { spawn, exec } from 'child_process';
import path from 'path';
import fs, { promises as fsPromises } from 'fs';
import os from 'os';
import axios from 'axios';
import extract from 'extract-zip';
import { logger } from './logger';
import { settingsStore } from './settings';

export interface ToolDef {
  name: string;
  displayName: string;
  category: 'recon' | 'dast' | 'fuzz' | 'network';
  repo: string;
  exeName: string;
  assetPrefix: string;
  assetSuffix: string;
  versionFlag: string;
  requiresManual?: boolean;
}

export interface ToolHealthInfo {
  name: string;
  displayName: string;
  category: 'recon' | 'dast' | 'fuzz' | 'network';
  installed: boolean;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  resolvedPath: string;
  requiresManual?: boolean;
}

export const MANAGED_TOOLS: ToolDef[] = [
  { name: 'nuclei', displayName: 'Nuclei Engine', category: 'dast', repo: 'projectdiscovery/nuclei', exeName: 'nuclei.exe', assetPrefix: 'nuclei_', assetSuffix: '_windows_amd64.zip', versionFlag: '-version' },
  { name: 'subfinder', displayName: 'Subfinder', category: 'recon', repo: 'projectdiscovery/subfinder', exeName: 'subfinder.exe', assetPrefix: 'subfinder_', assetSuffix: '_windows_amd64.zip', versionFlag: '-version' },
  { name: 'httpx', displayName: 'HTTPX', category: 'recon', repo: 'projectdiscovery/httpx', exeName: 'httpx.exe', assetPrefix: 'httpx_', assetSuffix: '_windows_amd64.zip', versionFlag: '-version' },
  { name: 'naabu', displayName: 'Naabu Port Scanner', category: 'recon', repo: 'projectdiscovery/naabu', exeName: 'naabu.exe', assetPrefix: 'naabu_', assetSuffix: '_windows_amd64.zip', versionFlag: '-version' },
  { name: 'katana', displayName: 'Katana Spider', category: 'recon', repo: 'projectdiscovery/katana', exeName: 'katana.exe', assetPrefix: 'katana_', assetSuffix: '_windows_amd64.zip', versionFlag: '-version' },
  { name: 'dnsx', displayName: 'DNSX Resolver', category: 'recon', repo: 'projectdiscovery/dnsx', exeName: 'dnsx.exe', assetPrefix: 'dnsx_', assetSuffix: '_windows_amd64.zip', versionFlag: '-version' },
  { name: 'alterx', displayName: 'Alterx Permutation', category: 'recon', repo: 'projectdiscovery/alterx', exeName: 'alterx.exe', assetPrefix: 'alterx_', assetSuffix: '_windows_amd64.zip', versionFlag: '-version' },
  { name: 'tlsx', displayName: 'TLSX SSL/TLS Grabber', category: 'recon', repo: 'projectdiscovery/tlsx', exeName: 'tlsx.exe', assetPrefix: 'tlsx_', assetSuffix: '_windows_amd64.zip', versionFlag: '-version' },
  { name: 'ffuf', displayName: 'FFUF Web Fuzzer', category: 'fuzz', repo: 'ffuf/ffuf', exeName: 'ffuf.exe', assetPrefix: 'ffuf_', assetSuffix: '_windows_amd64.zip', versionFlag: '-V' },
  { name: 'wapiti', displayName: 'Wapiti DAST', category: 'dast', repo: '', exeName: 'wapiti', assetPrefix: '', assetSuffix: '', versionFlag: '--version', requiresManual: true },
  { name: 'nmap', displayName: 'Nmap Network Scanner', category: 'network', repo: '', exeName: 'nmap.exe', assetPrefix: '', assetSuffix: '', versionFlag: '-V', requiresManual: true },
  { name: 'zap', displayName: 'OWASP ZAP', category: 'dast', repo: '', exeName: 'zap.bat', assetPrefix: '', assetSuffix: '', versionFlag: '-version', requiresManual: true }
];

export class ToolManager {
  private binDir: string;
  private versionCache: Map<string, { version: string; timestamp: number }> = new Map();

  constructor() {
    this.binDir = path.join(os.homedir(), 'AppData', 'Roaming', 'ReconApp', 'bin');
    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }
  }

  getBinDir(): string {
    return this.binDir;
  }

  resolveToolPath(toolName: string): string {
    const settings = settingsStore.get();
    const settingMap: Record<string, string | undefined> = {
      nuclei: settings.nucleiPath,
      subfinder: settings.subfinderPath,
      httpx: settings.httpxPath,
      naabu: settings.naabuPath,
      katana: settings.katanaPath,
      dnsx: settings.dnsxPath,
      alterx: settings.alterxPath,
      tlsx: settings.tlsxPath,
      ffuf: settings.ffufPath,
      wapiti: settings.wapitiPath,
      nmap: settings.nmapPath,
      zap: settings.zapPath,
    };

    if (settingMap[toolName] && fs.existsSync(settingMap[toolName]!)) {
      return settingMap[toolName]!;
    }

    const tool = MANAGED_TOOLS.find(t => t.name === toolName);
    const exeName = tool ? tool.exeName : (process.platform === 'win32' ? `${toolName}.exe` : toolName);

    // 1. Check AppData binDir
    const inBin = path.join(this.binDir, exeName);
    if (fs.existsSync(inBin)) return inBin;

    // 2. Check ~/go/bin on Windows
    if (process.platform === 'win32') {
      const inGo = path.join(os.homedir(), 'go', 'bin', exeName);
      if (fs.existsSync(inGo)) return inGo;
    }

    // 3. Fallback to raw name for PATH resolution
    return tool ? tool.exeName : toolName;
  }

  async getInstalledVersion(tool: ToolDef, resolvedPath: string): Promise<string> {
    return new Promise((resolve) => {
      const child = spawn(resolvedPath, [tool.versionFlag], { shell: true });
      let output = '';

      child.stdout?.on('data', (d) => { output += d.toString(); });
      child.stderr?.on('data', (d) => { output += d.toString(); });

      const timeout = setTimeout(() => {
        try { child.kill(); } catch { /* ignore */ }
        resolve('Unknown');
      }, 3500);

      child.on('close', () => {
        clearTimeout(timeout);
        const match = output.match(/v?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
        if (match) {
          resolve(match[0].startsWith('v') ? match[0] : `v${match[0]}`);
        } else if (output.trim()) {
          const firstLine = output.trim().split('\n')[0].slice(0, 24);
          resolve(firstLine || 'Installed');
        } else {
          resolve('Unknown');
        }
      });

      child.on('error', () => {
        clearTimeout(timeout);
        resolve('Not Installed');
      });
    });
  }

  async getLatestGitHubVersion(repo: string): Promise<string> {
    if (!repo) return 'N/A';
    const cached = this.versionCache.get(repo);
    const now = Date.now();
    if (cached && now - cached.timestamp < 1000 * 60 * 60) {
      return cached.version;
    }

    try {
      const res = await axios.get(`https://api.github.com/repos/${repo}/releases/latest`, {
        timeout: 5000,
        headers: { 'User-Agent': 'SecOps-ReconApp' }
      });
      const tag = res.data.tag_name || 'Unknown';
      this.versionCache.set(repo, { version: tag, timestamp: now });
      return tag;
    } catch {
      return cached?.version || 'Check GitHub';
    }
  }

  async getHealthMatrix(): Promise<ToolHealthInfo[]> {
    const results: ToolHealthInfo[] = [];

    for (const tool of MANAGED_TOOLS) {
      const resolved = this.resolveToolPath(tool.name);
      let installed = false;

      if (path.isAbsolute(resolved)) {
        installed = fs.existsSync(resolved);
      } else {
        // Quick PATH existence check
        installed = await this.checkPathExists(resolved);
      }

      let currentVersion = 'Not Installed';
      if (installed) {
        currentVersion = await this.getInstalledVersion(tool, resolved);
        if (currentVersion === 'Not Installed') installed = false;
      }

      let latestVersion = 'N/A';
      if (tool.repo) {
        latestVersion = await this.getLatestGitHubVersion(tool.repo);
      } else if (tool.name === 'wapiti') {
        latestVersion = 'PyPI (Latest)';
      }

      let updateAvailable = false;
      if (installed && latestVersion && latestVersion !== 'N/A' && !latestVersion.includes('Check')) {
        const cleanCurrent = currentVersion.replace(/^v/, '').trim();
        const cleanLatest = latestVersion.replace(/^v/, '').trim();
        if (cleanCurrent !== cleanLatest && cleanCurrent !== 'Unknown') {
          updateAvailable = true;
        }
      }

      results.push({
        name: tool.name,
        displayName: tool.displayName,
        category: tool.category,
        installed,
        currentVersion,
        latestVersion,
        updateAvailable,
        resolvedPath: resolved,
        requiresManual: tool.requiresManual,
      });
    }

    return results;
  }

  private checkPathExists(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
      exec(checkCmd, (err) => {
        resolve(!err);
      });
    });
  }

  async updateTool(toolName: string, sender: Electron.WebContents): Promise<boolean> {
    const sendOutput = (msg: string) => {
      logger.info(msg, 'ToolManager');
      if (!sender.isDestroyed()) {
        sender.send('tools:update-progress', { tool: toolName, message: msg });
      }
    };

    sendOutput(`[*] Starting update for ${toolName}...`);

    if (toolName === 'nuclei-templates') {
      const nucleiBin = this.resolveToolPath('nuclei');
      sendOutput('[+] Running nuclei -update-templates...');
      const ok = await this.runProcess(nucleiBin, ['-update-templates'], sendOutput);
      sendOutput(ok ? '[+] Nuclei templates updated successfully!' : '[-] Failed to update nuclei templates.');
      return ok;
    }

    if (toolName === 'wapiti') {
      sendOutput('[+] Upgrading Wapiti via pip...');
      const ok = await this.runProcess('pip', ['install', '--upgrade', 'wapiti3'], sendOutput);
      sendOutput(ok ? '[+] Wapiti updated successfully!' : '[-] Failed to upgrade Wapiti via pip.');
      return ok;
    }

    const tool = MANAGED_TOOLS.find(t => t.name === toolName);
    if (!tool) {
      sendOutput(`[-] Unknown tool: ${toolName}`);
      return false;
    }

    if (tool.requiresManual) {
      sendOutput(`[!] ${tool.displayName} requires manual package installation on your operating system.`);
      return true;
    }

    // Layer 1: Attempt native -update flag
    const resolvedPath = this.resolveToolPath(tool.name);
    sendOutput(`[+] Layer 1: Attempting native CLI update via ${resolvedPath} -update...`);
    const cliSuccess = await this.runProcess(resolvedPath, ['-update'], sendOutput);

    if (cliSuccess) {
      sendOutput(`[+] Successfully updated ${tool.displayName} via native CLI!`);
      return true;
    }

    // Layer 2: Fallback to direct GitHub Release Download
    sendOutput(`[!] Layer 1 CLI update failed or not supported. Activating Layer 2: Direct GitHub Release Downloader...`);
    return await this.downloadAndExtractRelease(tool, sendOutput);
  }

  private async downloadAndExtractRelease(tool: ToolDef, sendOutput: (msg: string) => void): Promise<boolean> {
    try {
      sendOutput(`[+] Fetching latest release info for ${tool.repo}...`);
      const apiURL = `https://api.github.com/repos/${tool.repo}/releases/latest`;
      const response = await axios.get(apiURL, {
        headers: { 'User-Agent': 'SecOps-ReconApp' },
        timeout: 10000
      });

      const version = response.data.tag_name.replace(/^v/, '');
      const assetName = `${tool.assetPrefix}${version}${tool.assetSuffix}`;
      const asset = response.data.assets.find((a: { name: string }) => a.name === assetName);

      if (!asset) {
        throw new Error(`Asset ${assetName} not found in GitHub release.`);
      }

      const zipPath = path.join(this.binDir, assetName);
      sendOutput(`[+] Downloading ${assetName} directly to ${this.binDir}...`);

      const dlRes = await axios({
        method: 'GET',
        url: asset.browser_download_url,
        responseType: 'stream',
        timeout: 60000,
      });

      const writer = fs.createWriteStream(zipPath);
      await new Promise<void>((resolve, reject) => {
        dlRes.data.pipe(writer);
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      sendOutput(`[+] Extracting ${assetName}...`);
      await extract(zipPath, { dir: this.binDir });

      // Clean zip
      await fsPromises.unlink(zipPath);
      sendOutput(`[+] Successfully installed and updated ${tool.displayName} to latest release (${version})!`);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendOutput(`[-] Error during direct download fallback: ${msg}`);
      return false;
    }
  }

  async updateAll(sender: Electron.WebContents): Promise<void> {
    const sendOutput = (msg: string) => {
      logger.info(msg, 'ToolManager');
      if (!sender.isDestroyed()) {
        sender.send('tools:update-progress', { tool: 'ALL', message: msg });
      }
    };

    sendOutput('[*] === STARTING MASTER ENGINE & TOOL SUITE UPDATE ===');

    // 1. Update Nuclei Engine
    await this.updateTool('nuclei', sender);

    // 2. Update Nuclei Templates
    await this.updateTool('nuclei-templates', sender);

    // 3. Update Wapiti
    await this.updateTool('wapiti', sender);

    // 4. Update ProjectDiscovery suite & FFUF
    const toolsToUpdate = ['subfinder', 'httpx', 'naabu', 'katana', 'dnsx', 'alterx', 'tlsx', 'ffuf'];
    for (const tool of toolsToUpdate) {
      await this.updateTool(tool, sender);
    }

    sendOutput('[*] === ALL TOOL ENGINE UPDATES FINISHED ===');
    if (!sender.isDestroyed()) {
      sender.send('tools:update-status', 'DONE');
    }
  }

  private runProcess(command: string, args: string[], sendOutput: (msg: string) => void): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn(command, args, { shell: true });

        proc.stdout?.on('data', (d) => {
          sendOutput(d.toString().trim());
        });

        proc.stderr?.on('data', (d) => {
          sendOutput(d.toString().trim());
        });

        proc.on('close', (code) => {
          resolve(code === 0);
        });

        proc.on('error', (err) => {
          sendOutput(`[-] Process error: ${err.message}`);
          resolve(false);
        });
      } catch (err: unknown) {
        sendOutput(`[-] Exception: ${(err as Error).message}`);
        resolve(false);
      }
    });
  }
}

export const toolManager = new ToolManager();
