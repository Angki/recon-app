import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import extract from 'extract-zip';
import { exec, spawn } from 'child_process';
import { logger } from './logger';

import { toolCatalog } from './catalog';
import { activeRuntime, isActiveValidationTool } from './scanners/activeValidation';
import { settingsStore } from './settings';
import { installActiveTool, supportsActiveInstall } from './activeToolInstaller';

export interface ToolDependency {
  name: string;
  repo: string;
  exeName: string;
  assetPrefix: string;
  assetSuffix: string;
  requiresManual?: boolean;
  pipPackage?: string;
  gitRepo?: string;
}

export const DEPENDENCIES: ToolDependency[] = toolCatalog.getAll().map(tool => {
  const strategy = tool.installStrategy;
  return {
    name: tool.id,
    repo: strategy.type === 'github-release' ? strategy.repo : '',
    exeName: strategy.exeName,
    assetPrefix: strategy.type === 'github-release' ? strategy.assetPrefix : '',
    assetSuffix: strategy.type === 'github-release' ? strategy.assetSuffix : '',
    requiresManual: supportsActiveInstall(tool.id) ? false : tool.requiresManual || tool.isCommercial,
    pipPackage: strategy.type === 'pip' ? strategy.package : undefined,
    gitRepo: strategy.type === 'git-clone' ? strategy.gitRepo : undefined,
  };
});

export class DependencyService {
  private binDir: string;
  private toolsDir: string;

  constructor() {
    this.binDir = path.join(os.homedir(), 'AppData', 'Roaming', 'ReconApp', 'bin');
    this.toolsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'ReconApp', 'tools');
    if (!fs.existsSync(this.binDir)) fs.mkdirSync(this.binDir, { recursive: true });
    if (!fs.existsSync(this.toolsDir)) fs.mkdirSync(this.toolsDir, { recursive: true });
    this.syncExistingBinaries();
  }

  private syncExistingBinaries(): void {
    try {
      const goBin = path.join(os.homedir(), 'go', 'bin');
      if (fs.existsSync(goBin)) {
        const goFiles = fs.readdirSync(goBin);
        for (const file of goFiles) {
          if (file.endsWith('.exe')) {
            const src = path.join(goBin, file);
            const dst = path.join(this.binDir, file);
            if (!fs.existsSync(dst)) {
              try { fs.copyFileSync(src, dst); } catch { /* ignore copy error */ }
            }
          }
        }
      }

      const pyDirs = [
        path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python314', 'Scripts'),
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts'),
        'C:\\Python314\\Scripts'
      ];
      for (const pyDir of pyDirs) {
        if (fs.existsSync(pyDir)) {
          const files = fs.readdirSync(pyDir);
          for (const file of files) {
            if (file.endsWith('.exe')) {
              const src = path.join(pyDir, file);
              const dst = path.join(this.binDir, file);
              if (!fs.existsSync(dst)) {
                try { fs.copyFileSync(src, dst); } catch { /* ignore copy error */ }
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  getBinPath(toolName: string): string {
    const tool = DEPENDENCIES.find(t => t.name === toolName);
    if (!tool) return toolName;
    
    // Check if directly in binDir
    const possible = [
      path.join(this.binDir, tool.exeName),
      path.join(this.binDir, `${tool.name}.exe`),
      path.join(this.binDir, `${tool.name}.cmd`),
      path.join(this.binDir, `${tool.name}.bat`),
    ];
    for (const p of possible) {
      if (fs.existsSync(p)) return p;
    }

    if (tool.requiresManual) {
      return tool.exeName;
    }

    return path.join(this.binDir, tool.exeName);
  }

  isInstalled(toolName: string): boolean {
    if (isActiveValidationTool(toolName)) {
      try { activeRuntime(toolName, settingsStore.get() as unknown as Record<string, unknown>); return true; }
      catch { return false; }
    }
    const tool = DEPENDENCIES.find(t => t.name === toolName);
    if (!tool) return false;

    // 1. Check AppData binDir
    const candidates = [
      path.join(this.binDir, tool.exeName),
      path.join(this.binDir, `${tool.name}.exe`),
      path.join(this.binDir, `${tool.name}.cmd`),
      path.join(this.binDir, `${tool.name}.bat`),
    ];
    if (candidates.some(p => fs.existsSync(p))) return true;

    // 2. Check ~/go/bin on Windows
    if (process.platform === 'win32') {
      const inGo = path.join(os.homedir(), 'go', 'bin', tool.exeName);
      if (fs.existsSync(inGo)) return true;
    }

    // 3. Check Python Scripts directory on Windows
    if (process.platform === 'win32') {
      const pythonDirs = [
        path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python314', 'Scripts', tool.exeName),
        path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python313', 'Scripts', tool.exeName),
        path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Python312', 'Scripts', tool.exeName),
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts', tool.exeName),
        path.join('C:\\Python314', 'Scripts', tool.exeName),
      ];
      if (pythonDirs.some(p => fs.existsSync(p))) return true;
    }
    
    // 4. Fallback checks for nmap and zap
    if (tool.name === 'nmap') {
      if (fs.existsSync('C:\\Program Files (x86)\\Nmap\\nmap.exe') || fs.existsSync('C:\\Program Files\\Nmap\\nmap.exe')) return true;
    }
    if (tool.name === 'zap') {
      if (fs.existsSync('C:\\Program Files\\ZAP\\Zed Attack Proxy\\zap.bat')) return true;
    }

    return false;
  }

  async installTool(tool: ToolDependency, sender: Electron.WebContents): Promise<boolean> {
    if (supportsActiveInstall(tool.name)) {
      try { return await installActiveTool(tool.name,message=>this.sendProgress(sender,tool.name,message)); }
      catch (error) { this.sendProgress(sender,tool.name,`Installation failed: ${error instanceof Error ? error.message : String(error)}`,true); return false; }
    }
    if (tool.requiresManual) {
      this.sendProgress(sender, tool.name, `${tool.name} requires manual installer download.`);
      return true;
    }

    // A. Python pip package
    if (tool.pipPackage) {
      return this.installPipPackage(tool, sender);
    }

    // B. Git repository clone
    if (tool.gitRepo) {
      return this.installGitTool(tool, sender);
    }

    // C. GitHub Release download
    if (tool.repo) {
      return this.installGitHubRelease(tool, sender);
    }

    return true;
  }

  private async installPipPackage(tool: ToolDependency, sender: Electron.WebContents): Promise<boolean> {
    return new Promise((resolve) => {
      this.sendProgress(sender, tool.name, `Running pip install -U ${tool.pipPackage}...`);
      const proc = spawn('pip', ['install', '-U', tool.pipPackage!], { shell: false });
      proc.stdout?.on('data', d => this.sendProgress(sender, tool.name, d.toString().trim()));
      proc.stderr?.on('data', d => this.sendProgress(sender, tool.name, d.toString().trim()));
      proc.on('close', (code) => {
        if (code === 0) {
          this.syncExistingBinaries();
          this.sendProgress(sender, tool.name, `Successfully installed ${tool.name} via pip.`);
          resolve(true);
        } else {
          this.sendProgress(sender, tool.name, `Failed to install ${tool.name} via pip (exit ${code}).`, true);
          resolve(false);
        }
      });
      proc.on('error', (err) => {
        this.sendProgress(sender, tool.name, `Pip error: ${err.message}`, true);
        resolve(false);
      });
    });
  }

  private async installGitTool(tool: ToolDependency, sender: Electron.WebContents): Promise<boolean> {
    return new Promise((resolve) => {
      const folderName = tool.name === 'corsy' ? 'Corsy' : tool.name === 'cmseek' ? 'CMSeeK' : tool.name;
      const targetDir = path.join(this.toolsDir, folderName);
      const scriptName = tool.name === 'corsy' ? 'corsy.py' : 'cmseek.py';

      const createWrapper = () => {
        const scriptPath = path.join(targetDir, scriptName);
        if (fs.existsSync(scriptPath)) {
          const cmdContent = `@echo off\r\nset PYTHONIOENCODING=utf-8\r\npython "${scriptPath}" %*\r\n`;
          fs.writeFileSync(path.join(this.binDir, `${tool.name}.cmd`), cmdContent);
          fs.writeFileSync(path.join(this.binDir, `${tool.name}.bat`), cmdContent);
          this.sendProgress(sender, tool.name, `Ready: created ${tool.name}.cmd runner.`);
          resolve(true);
        } else {
          resolve(false);
        }
      };

      if (fs.existsSync(targetDir)) {
        createWrapper();
        return;
      }

      this.sendProgress(sender, tool.name, `Cloning ${tool.gitRepo}...`);
      const proc = spawn('git', ['clone', '--depth', '1', tool.gitRepo!, targetDir], { shell: false });
      proc.on('close', (code) => {
        if (code === 0) {
          createWrapper();
        } else {
          this.sendProgress(sender, tool.name, `Git clone failed with code ${code}.`, true);
          resolve(false);
        }
      });
      proc.on('error', (err) => {
        this.sendProgress(sender, tool.name, `Git error: ${err.message}`, true);
        resolve(false);
      });
    });
  }

  private async installGitHubRelease(tool: ToolDependency, sender: Electron.WebContents): Promise<boolean> {
    try {
      this.sendProgress(sender, tool.name, 'Fetching latest release info from GitHub...');
      
      const apiURL = `https://api.github.com/repos/${tool.repo}/releases/latest`;
      const response = await axios.get(apiURL, {
        headers: { 'User-Agent': 'SecOps-ReconApp' },
        timeout: 10000
      });
      const version = response.data.tag_name.replace(/^v/, '');
      const expectedAssetName = `${tool.assetPrefix}${version}${tool.assetSuffix}`;
      
      // Try exact match, fallback to intelligent regex asset finder
      let asset = response.data.assets.find((a: { name: string }) => a.name === expectedAssetName);
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

      if (!asset) {
        throw new Error(`Compatible Windows release asset not found for ${tool.name}.`);
      }

      const assetName = asset.name;
      this.sendProgress(sender, tool.name, `Downloading ${assetName}...`);
      
      const zipPath = path.join(this.binDir, assetName);
      await this.downloadFile(asset.browser_download_url, zipPath, (progress) => {
        this.sendProgress(sender, tool.name, `Downloading: ${Math.round(progress)}%`);
      });

      this.sendProgress(sender, tool.name, 'Extracting archive...');
      
      // Safe extraction
      await extract(zipPath, { dir: this.binDir });
      
      // Flatten binary to root binDir if extracted into a subfolder
      await this.ensureBinaryAtRoot(tool.exeName);

      // Cleanup zip
      try { await fsPromises.unlink(zipPath); } catch { /* ignore unlink error */ }
      
      // If nuclei was installed, automatically update templates
      if (tool.name === 'nuclei') {
        this.sendProgress(sender, tool.name, 'Updating nuclei templates...');
        await new Promise(r => {
          exec(`"${path.join(this.binDir, 'nuclei.exe')}" -update-templates`, () => r(null));
        });
      }

      this.sendProgress(sender, tool.name, 'Installed successfully.');
      return true;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to install ${tool.name}`, errorMessage);
      this.sendProgress(sender, tool.name, `Error: ${errorMessage}`, true);
      return false;
    }
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

  async checkAndInstallAll(sender: Electron.WebContents): Promise<void> {
    for (const tool of DEPENDENCIES) {
      if (!tool.requiresManual && !this.isInstalled(tool.name)) {
        await this.installTool(tool, sender);
      }
    }
    safeSend(sender, 'dependencies:ready', { status: 'all_installed' });
  }

  private sendProgress(sender: Electron.WebContents, tool: string, message: string, isError = false) {
    logger.info(`[Install ${tool}] ${message}`);
    safeSend(sender, 'dependency:progress', { tool, message, isError });
  }

  private async downloadFile(url: string, dest: string, onProgress: (percent: number) => void): Promise<void> {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const rawLength = response.headers['content-length'];
    const totalLength = rawLength ? parseInt(String(rawLength), 10) : 0;
    let downloaded = 0;

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(dest);
      response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (totalLength > 0) {
          onProgress((downloaded / totalLength) * 100);
        }
      });
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}

export const dependencyService = new DependencyService();

// Helper to safely send IPC messages
function safeSend(sender: Electron.WebContents, channel: string, data: unknown) {
  if (sender && !sender.isDestroyed()) {
    sender.send(channel, data);
  }
}
