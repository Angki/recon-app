import { spawn, exec } from 'child_process';
import path from 'path';
import fs, { promises as fsPromises } from 'fs';
import os from 'os';
import axios from 'axios';
import extract from 'extract-zip';
import { logger } from './logger';
import { settingsStore } from './settings';
import { activeRuntime, isActiveValidationTool } from './scanners/activeValidation';
import type { ToolCategory } from './catalog/types';
import { installActiveTool, supportsActiveInstall } from './activeToolInstaller';
import { processLock } from './platform/processLock';
import { StagingInstaller } from './platform/installer';
import { pythonVenv } from './platform/pythonVenv';

export interface ToolDef {
  name: string;
  displayName: string;
  category: ToolCategory;
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
  category: ToolCategory;
  installed: boolean;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  resolvedPath: string;
  requiresManual?: boolean;
}

import { toolCatalog } from './catalog';

export const MANAGED_TOOLS: ToolDef[] = toolCatalog.getAll().map(tool => {
  const strategy = tool.installStrategy;
  return {
    name: tool.id,
    displayName: tool.displayName,
    category: tool.category,
    repo: strategy.type === 'github-release' ? strategy.repo : '',
    exeName: strategy.exeName,
    assetPrefix: strategy.type === 'github-release' ? strategy.assetPrefix : '',
    assetSuffix: strategy.type === 'github-release' ? strategy.assetSuffix : '',
    versionFlag: tool.versionFlag,
    requiresManual: tool.requiresManual || tool.isCommercial
  };
});

export class ToolManager {
  private binDir: string;
  private stagingInstaller: StagingInstaller;
  private versionCache: Map<string, { version: string; timestamp: number }> = new Map();

  constructor(customBinDir?: string) {
    this.binDir = customBinDir || path.join(os.homedir(), 'AppData', 'Roaming', 'ReconApp', 'bin');
    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }
    this.stagingInstaller = new StagingInstaller(this.binDir);
  }

  getStagingInstaller(): StagingInstaller {
    return this.stagingInstaller;
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
      syft: settings.syftPath,
      interactsh: settings.interactshPath,
    };

    if (settingMap[toolName] && fs.existsSync(settingMap[toolName]!)) {
      return settingMap[toolName]!;
    }

    const tool = MANAGED_TOOLS.find(t => t.name === toolName);
    const exeName = tool ? tool.exeName : (process.platform === 'win32' ? `${toolName}.exe` : toolName);

    // 0. Check tool's isolated Python venv first if applicable
    const inVenv = pythonVenv.getVenvExecutable(toolName, exeName);
    if (fs.existsSync(inVenv)) return inVenv;

    // 1. Check packaged resources directory if running inside packaged electron app
    if (process.resourcesPath) {
      const inResources = path.join(process.resourcesPath, 'bin', exeName);
      if (fs.existsSync(inResources)) return inResources;
    }

    // 2. Check AppData binDir
    const inBin = path.join(this.binDir, exeName);
    if (fs.existsSync(inBin)) return inBin;

    // 3. Check ~/go/bin on Windows
    if (process.platform === 'win32') {
      const inGo = path.join(os.homedir(), 'go', 'bin', exeName);
      if (fs.existsSync(inGo)) return inGo;
    }

    // 3. Check Python Scripts directories on Windows (for tools like wafw00f, arjun, crlfsuite)
    if (process.platform === 'win32') {
      const pythonScriptsPaths = [
        path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python314', 'Scripts', exeName),
        path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python313', 'Scripts', exeName),
        path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python312', 'Scripts', exeName),
        path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python311', 'Scripts', exeName),
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python314', 'Scripts', exeName),
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python313', 'Scripts', exeName),
        path.join('C:\\Python314', 'Scripts', exeName),
        path.join('C:\\Python313', 'Scripts', exeName),
        path.join('C:\\Python312', 'Scripts', exeName),
      ];
      for (const p of pythonScriptsPaths) {
        if (fs.existsSync(p)) return p;
      }
    }

    // 4. Fallback for Nmap / ZAP on Windows
    if (process.platform === 'win32') {
      if (toolName === 'nmap') {
        const fallbacks = [
          'C:\\Program Files (x86)\\Nmap\\nmap.exe',
          'C:\\Program Files\\Nmap\\nmap.exe'
        ];
        for (const p of fallbacks) {
          if (fs.existsSync(p)) return p;
        }
      }
      if (toolName === 'zap') {
        const zapFb = 'C:\\Program Files\\ZAP\\Zed Attack Proxy\\zap.bat';
        if (fs.existsSync(zapFb)) return zapFb;
      }
    }

    // 5. Fallback to raw name for PATH resolution
    return tool ? tool.exeName : toolName;
  }

  async getInstalledVersion(tool: ToolDef, resolvedPath: string): Promise<string> {
    return new Promise((resolve) => {
      const isBat = resolvedPath.toLowerCase().endsWith('.bat') || resolvedPath.toLowerCase().endsWith('.cmd');
      const executable = isBat ? (process.env.comspec || 'cmd.exe') : resolvedPath;
      const args = isBat ? ['/c', path.basename(resolvedPath), tool.versionFlag] : [tool.versionFlag];
      const cwd = isBat ? path.dirname(resolvedPath) : undefined;
      const child = spawn(executable, args, { cwd, shell: !isBat && !path.isAbsolute(resolvedPath) });
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
      if (isActiveValidationTool(tool.name)) {
        let resolvedPath = '';
        let currentVersion: string;
        let installed = false;
        try {
          const runtime = activeRuntime(tool.name, settingsStore.get() as unknown as Record<string, unknown>);
          resolvedPath = runtime.script;
          const result = await new Promise<string>((resolve) => {
            const args = runtime.kind === 'docker'
              ? ['run','--rm','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',runtime.image,tool.versionFlag]
              : [runtime.script, tool.versionFlag];
            const child = spawn(runtime.executable, args, { shell: false, cwd: runtime.kind === 'script' ? path.dirname(runtime.script) : undefined, windowsHide: true });
            let output = '';
            const collect = (data: Buffer) => { output = (output + data.toString()).slice(0, 8192); };
            child.stdout?.on('data', collect);
            child.stderr?.on('data', collect);
            const timer = setTimeout(() => { child.kill(); resolve(''); }, 5000);
            child.on('error', () => { clearTimeout(timer); resolve(''); });
            child.on('close', code => { clearTimeout(timer); resolve(code === 0 ? output.trim() : ''); });
          });
          installed = Boolean(result);
          currentVersion = result.match(/Nikto\s+v?[\d.]+/i)?.[0] || result.split('\n')[0].slice(0, 80) || 'Runtime check failed';
        } catch (error) { currentVersion = error instanceof Error ? error.message : String(error); }
        results.push({ name:tool.name, displayName:tool.displayName, category:tool.category, installed, currentVersion, latestVersion:supportsActiveInstall(tool.name) ? 'Pinned official revision' : 'Manual upstream', updateAvailable:false, resolvedPath, requiresManual:!supportsActiveInstall(tool.name) });
        continue;
      }
      const resolved = this.resolveToolPath(tool.name);
      let installed: boolean;

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
    try {
      processLock.assertToolNotLocked(toolName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendOutput(`[-] ${msg}`);
      return false;
    }

    if (supportsActiveInstall(toolName)) {
      try { return await installActiveTool(toolName,sendOutput); }
      catch (error) { sendOutput(`[-] Installation failed; previous runtime retained: ${error instanceof Error ? error.message : String(error)}`); return false; }
    }
    if (isActiveValidationTool(toolName)) {
      sendOutput(`[!] Install the official ${toolName} source and configure its interpreter and script in Dashboard > Active Testing. No automatic update was performed.`);
      return false;
    }

    if (toolName === 'nuclei-templates') {
      const nucleiBin = this.resolveToolPath('nuclei');
      sendOutput('[+] Running nuclei -update-templates...');
      const ok = await this.runProcess(nucleiBin, ['-update-templates'], sendOutput);
      sendOutput(ok ? '[+] Nuclei templates updated successfully!' : '[-] Failed to update nuclei templates.');
      return ok;
    }

    if (toolName === 'whatweb') {
      sendOutput('[i] WhatWeb uses Ruby, not pip. Install from https://github.com/urbanadventurer/WhatWeb and configure its wrapper in the ReconApp bin directory. Automatic source updates are not supported.');
      return false;
    }

    // Python pip packages
    const pipTools: Record<string, string> = {
      wapiti: 'wapiti3',
      wafw00f: 'wafw00f',
      arjun: 'arjun',
      crlfsuite: 'crlfsuite',
      semgrep: 'semgrep',
      schemathesis: 'schemathesis',
      sslyze: 'sslyze'
    };

    if (pipTools[toolName]) {
      const pkg = pipTools[toolName];
      sendOutput(`[+] Installing/upgrading ${toolName} (${pkg}) in isolated virtualenv...`);
      const manifest = toolCatalog.get(toolName);
      const ok = await pythonVenv.installInVenv(toolName, pkg, manifest?.pinnedVersion, sendOutput);
      if (ok) {
        const exeName = (manifest?.installStrategy as { exeName?: string })?.exeName || (process.platform === 'win32' ? `${toolName}.exe` : toolName);
        const venvExe = pythonVenv.getVenvExecutable(toolName, exeName);
        const dst = path.join(this.binDir, exeName);
        if (fs.existsSync(venvExe)) {
          try {
            await this.stagingInstaller.atomicActivate(venvExe, dst, {
              toolId: toolName,
              version: manifest?.pinnedVersion || 'latest',
              sourceUrl: manifest?.sourceUrl || `https://pypi.org/project/${pkg}`,
              installType: 'python-venv',
              binaryPath: dst
            });
          } catch {
            try { fs.copyFileSync(venvExe, dst); } catch { /* ignore */ }
          }
        }
      }
      sendOutput(ok ? `[+] ${toolName} updated successfully in isolated virtualenv!` : `[-] Failed to install ${toolName} in virtualenv.`);
      return ok;
    }

    // Git tools
    if (['corsy', 'cmseek'].includes(toolName)) {
      const folderName = toolName === 'corsy' ? 'Corsy' : 'CMSeeK';
      const targetDir = path.join(os.homedir(), 'AppData', 'Roaming', 'ReconApp', 'tools', folderName);
      if (fs.existsSync(targetDir)) {
        sendOutput(`[+] Pulling latest git changes for ${toolName}...`);
        await this.runProcess('git', ['-C', targetDir, 'pull'], sendOutput);
      } else {
        const repo = toolName === 'corsy' ? 'https://github.com/s0md3v/Corsy.git' : 'https://github.com/Tuhinshubhra/CMSeeK.git';
        sendOutput(`[+] Cloning ${toolName} from ${repo}...`);
        await this.runProcess('git', ['clone', '--depth', '1', repo, targetDir], sendOutput);
      }
      const scriptName = toolName === 'corsy' ? 'corsy.py' : 'cmseek.py';
      const cmdContent = `@echo off\r\nset PYTHONIOENCODING=utf-8\r\npython "${path.join(targetDir, scriptName)}" %*\r\n`;
      fs.writeFileSync(path.join(this.binDir, `${toolName}.cmd`), cmdContent);
      fs.writeFileSync(path.join(this.binDir, `${toolName}.bat`), cmdContent);
      sendOutput(`[+] ${toolName} updated successfully!`);
      return true;
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

    // Layer 1: Attempt native -update flag ONLY for ProjectDiscovery tools that natively support it
    const toolsSupportingCliUpdate = ['nuclei', 'subfinder', 'httpx', 'katana', 'alterx', 'dnsx', 'naabu', 'tlsx'];
    if (toolsSupportingCliUpdate.includes(tool.name)) {
      const resolvedPath = this.resolveToolPath(tool.name);
      sendOutput(`[+] Layer 1: Attempting native CLI update via ${resolvedPath} -update...`);
      const cliSuccess = await this.runProcess(resolvedPath, ['-update'], sendOutput);

      if (cliSuccess) {
        sendOutput(`[+] Successfully updated ${tool.displayName} via native CLI!`);
        return true;
      }
      sendOutput(`[!] Layer 1 CLI update failed or returned non-zero. Activating Layer 2: Direct GitHub Release Downloader...`);
    } else {
      sendOutput(`[i] Native -update flag not supported by ${tool.name}. Activating Direct GitHub Release Downloader...`);
    }

    // Layer 2: Fallback to direct GitHub Release Download
    return await this.downloadAndExtractRelease(tool, sendOutput);
  }

  private async downloadAndExtractRelease(tool: ToolDef, sendOutput: (msg: string) => void): Promise<boolean> {
    try {
      sendOutput(`[+] Fetching latest release info for ${tool.repo}...`);
      let version = '';
      let assetDownloadUrl = '';
      let assetName = '';

      try {
        const apiURL = `https://api.github.com/repos/${tool.repo}/releases/latest`;
        const response = await axios.get(apiURL, {
          headers: { 'User-Agent': 'SecOps-ReconApp' },
          timeout: 10000
        });

        version = response.data.tag_name.replace(/^v/, '');
        const expectedAssetName = `${tool.assetPrefix}${version}${tool.assetSuffix}`;

        // 1. Try exact asset name match
        let asset = response.data.assets.find((a: { name: string }) => a.name === expectedAssetName);

        // 2. Intelligent fuzzy asset finder for Windows amd64 zip
        if (!asset) {
          asset = response.data.assets.find((a: { name: string }) => {
            const name = a.name.toLowerCase();
            if (name.endsWith('.sha256') || name.endsWith('.sig') || name.endsWith('.txt') || name.endsWith('.xml') || name.endsWith('.deb') || name.endsWith('.rpm')) return false;
            if (!name.endsWith('.zip')) return false;
            if (!name.includes(tool.name.toLowerCase())) return false;
            if (!name.includes('windows') && !name.includes('win')) return false;
            if (name.includes('arm64') || name.includes('aarch64')) return false;
            return name.includes('amd64') || name.includes('x86_64') || name.includes('x64') || name.includes('64-bit') || name.includes('win64');
          });
        }

        if (asset) {
          assetName = asset.name;
          assetDownloadUrl = asset.browser_download_url;
        }
      } catch (apiErr: any) {
        if (apiErr.response?.status === 403) {
          sendOutput(`[!] GitHub API rate limit reached (HTTP 403). Falling back to direct HTML tag discovery...`);
          const headRes = await axios.get(`https://github.com/${tool.repo}/releases/latest`, {
            maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 15000
          });
          const finalUrl: string = headRes.request?.res?.responseUrl || headRes.config?.url || '';
          const tagMatch = finalUrl.match(/\/tag\/([^/?#]+)/);
          if (tagMatch) {
            const rawTag = tagMatch[1];
            version = rawTag.replace(/^v/, '');
            assetName = `${tool.assetPrefix}${version}${tool.assetSuffix}`;
            assetDownloadUrl = `https://github.com/${tool.repo}/releases/download/${rawTag}/${assetName}`;
            sendOutput(`[+] Resolved latest version ${version} via HTML redirect.`);
          } else {
            throw apiErr;
          }
        } else {
          throw apiErr;
        }
      }

      if (!assetDownloadUrl) {
        throw new Error(`Compatible Windows release asset not found for ${tool.name}.`);
      }

      // Download and extract into an isolated staging directory to protect active binaries
      const stagingDir = path.join(this.binDir, '.staging', `${tool.name}-${Date.now()}`);
      fs.mkdirSync(stagingDir, { recursive: true });
      const zipPath = path.join(stagingDir, assetName);
      sendOutput(`[+] Downloading ${assetName} to staging directory...`);

      const dlRes = await axios({
        method: 'GET',
        url: assetDownloadUrl,
        responseType: 'stream',
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      const writer = fs.createWriteStream(zipPath);
      await new Promise<void>((resolve, reject) => {
        dlRes.data.pipe(writer);
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      sendOutput(`[+] Extracting archive in staging...`);
      await extract(zipPath, { dir: stagingDir });

      // Locate binary inside staging directory
      const locateExe = (dir: string, depth = 0): string | null => {
        if (depth > 3) return null;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              const found = locateExe(full, depth + 1);
              if (found) return found;
            } else if (entry.isFile() && entry.name.toLowerCase() === tool.exeName.toLowerCase()) {
              return full;
            }
          }
        } catch {
          // ignore
        }
        return null;
      };

      const stagedBinary = locateExe(stagingDir);
      if (!stagedBinary || !fs.existsSync(stagedBinary)) {
        throw new Error(`Executable ${tool.exeName} was not found inside the downloaded archive.`);
      }

      // Checksum verification if pinned in catalog
      const manifest = toolCatalog.get(tool.name);
      if (manifest?.checksumSha256) {
        sendOutput(`[+] Verifying artifact SHA-256 checksum...`);
        this.stagingInstaller.verifyChecksum(stagedBinary, manifest.checksumSha256);
        sendOutput(`[+] Checksum verified successfully!`);
      }

      // Atomic activation: copy verified binary to production bin directory with rollback receipt
      const finalDest = path.join(this.binDir, tool.exeName);
      await this.stagingInstaller.atomicActivate(stagedBinary, finalDest, {
        toolId: tool.name,
        version: version || 'latest',
        sourceUrl: assetDownloadUrl,
        installType: 'github-release',
        binaryPath: finalDest
      });

      // Clean staging
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }

      sendOutput(`[+] Successfully activated ${tool.displayName} to latest release (${version}) with provenance receipt!`);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendOutput(`[-] Error during download fallback: ${msg}`);
      return false;
    }
  }

  rollbackTool(toolName: string): boolean {
    processLock.assertToolNotLocked(toolName);
    const tool = MANAGED_TOOLS.find(t => t.name === toolName);
    const exeName = tool ? tool.exeName : (process.platform === 'win32' ? `${toolName}.exe` : toolName);
    const liveFilePath = path.join(this.binDir, exeName);
    return this.stagingInstaller.rollback(toolName, liveFilePath);
  }

  uninstallTool(toolName: string, sender?: Electron.WebContents): boolean {
    processLock.assertToolNotLocked(toolName);
    const tool = MANAGED_TOOLS.find(t => t.name === toolName);
    const exeName = tool ? tool.exeName : (process.platform === 'win32' ? `${toolName}.exe` : toolName);
    const liveFilePath = path.join(this.binDir, exeName);
    let removed = false;
    if (fs.existsSync(liveFilePath)) {
      try {
        fs.unlinkSync(liveFilePath);
        removed = true;
      } catch { /* ignore */ }
    }
    const cmdPath = path.join(this.binDir, `${toolName}.cmd`);
    const batPath = path.join(this.binDir, `${toolName}.bat`);
    if (fs.existsSync(cmdPath)) { try { fs.unlinkSync(cmdPath); removed = true; } catch { /* ignore */ } }
    if (fs.existsSync(batPath)) { try { fs.unlinkSync(batPath); removed = true; } catch { /* ignore */ } }

    const venvDir = pythonVenv.getVenvDir(toolName);
    if (fs.existsSync(venvDir)) {
      try { fs.rmSync(venvDir, { recursive: true, force: true }); removed = true; } catch { /* ignore */ }
    }

    if (sender && !sender.isDestroyed()) {
      sender.send('tools:update-progress', { tool: toolName, message: removed ? `[+] Uninstalled ${toolName}` : `[-] ${toolName} was not found` });
    }
    return removed;
  }

  private async ensureBinaryAtRoot(exeName: string): Promise<void> {
    const rootTarget = path.join(this.binDir, exeName);
    if (fs.existsSync(rootTarget)) return;

    const findExe = (dir: string, depth = 0): string | null => {
      if (depth > 2) return null;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = findExe(full, depth + 1);
            if (found) return found;
          } else if (entry.isFile() && entry.name.toLowerCase() === exeName.toLowerCase()) {
            return full;
          }
        }
      } catch {
        // ignore
      }
      return null;
    };

    const located = findExe(this.binDir);
    if (located && located !== rootTarget) {
      await fsPromises.copyFile(located, rootTarget);
      logger.info(`Relocated ${exeName} from subfolder to ${rootTarget}`);
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

    // 1. Update Nuclei Engine & Templates
    await this.updateTool('nuclei', sender);
    await this.updateTool('nuclei-templates', sender);

    // 2. Update Python tools via pip
    const pyTools = ['wapiti', 'wafw00f', 'arjun', 'crlfsuite'];
    for (const tool of pyTools) {
      await this.updateTool(tool, sender);
    }

    // 3. Update Git tools
    await this.updateTool('corsy', sender);
    await this.updateTool('cmseek', sender);

    // 4. Update ProjectDiscovery suite, FFUF, Dalfox, GAU
    const toolsToUpdate = ['subfinder', 'httpx', 'naabu', 'katana', 'dnsx', 'alterx', 'tlsx', 'ffuf', 'dalfox', 'gau'];
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
        const isBat = command.toLowerCase().endsWith('.bat') || command.toLowerCase().endsWith('.cmd');
        const exe = isBat && process.platform === 'win32' ? (process.env.comspec || 'cmd.exe') : command;
        const finalArgs = isBat && process.platform === 'win32' ? ['/c', command, ...args] : args;
        const proc = spawn(exe, finalArgs, { shell: false });

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
