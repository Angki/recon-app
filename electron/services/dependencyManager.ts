import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import extract from 'extract-zip';
import { logger } from './logger';

export interface ToolDependency {
  name: string;
  repo: string; // e.g., "projectdiscovery/nuclei"
  exeName: string; // e.g., "nuclei.exe"
  assetPrefix: string; // e.g., "nuclei_"
  assetSuffix: string; // e.g., "_windows_amd64.zip"
  requiresManual?: boolean;
}

export const DEPENDENCIES: ToolDependency[] = [
  { name: 'nuclei', repo: 'projectdiscovery/nuclei', exeName: 'nuclei.exe', assetPrefix: 'nuclei_', assetSuffix: '_windows_amd64.zip' },
  { name: 'subfinder', repo: 'projectdiscovery/subfinder', exeName: 'subfinder.exe', assetPrefix: 'subfinder_', assetSuffix: '_windows_amd64.zip' },
  { name: 'httpx', repo: 'projectdiscovery/httpx', exeName: 'httpx.exe', assetPrefix: 'httpx_', assetSuffix: '_windows_amd64.zip' },
  { name: 'naabu', repo: 'projectdiscovery/naabu', exeName: 'naabu.exe', assetPrefix: 'naabu_', assetSuffix: '_windows_amd64.zip' },
  { name: 'katana', repo: 'projectdiscovery/katana', exeName: 'katana.exe', assetPrefix: 'katana_', assetSuffix: '_windows_amd64.zip' },
  { name: 'dnsx', repo: 'projectdiscovery/dnsx', exeName: 'dnsx.exe', assetPrefix: 'dnsx_', assetSuffix: '_windows_amd64.zip' },
  { name: 'alterx', repo: 'projectdiscovery/alterx', exeName: 'alterx.exe', assetPrefix: 'alterx_', assetSuffix: '_windows_amd64.zip' },
  { name: 'ffuf', repo: 'ffuf/ffuf', exeName: 'ffuf.exe', assetPrefix: 'ffuf_', assetSuffix: '_windows_amd64.zip' },
  // Tools requiring manual installation
  { name: 'nmap', repo: '', exeName: 'nmap.exe', assetPrefix: '', assetSuffix: '', requiresManual: true },
  { name: 'wapiti', repo: '', exeName: 'wapiti', assetPrefix: '', assetSuffix: '', requiresManual: true },
  { name: 'zap', repo: '', exeName: 'zap.bat', assetPrefix: '', assetSuffix: '', requiresManual: true }
];

export class DependencyService {
  private binDir: string;

  constructor() {
    this.binDir = path.join(os.homedir(), 'AppData', 'Roaming', 'ReconApp', 'bin');
    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }
  }

  getBinPath(toolName: string): string {
    const tool = DEPENDENCIES.find(t => t.name === toolName);
    if (!tool) return toolName;
    
    // For manual tools, we return just the tool name and assume it's in PATH
    if (tool.requiresManual) {
      return tool.exeName;
    }

    return path.join(this.binDir, tool.exeName);
  }

  isInstalled(toolName: string): boolean {
    const tool = DEPENDENCIES.find(t => t.name === toolName);
    if (!tool) return false;
    
    if (tool.requiresManual) {
      // We assume it's installed or we handle the missing check later via spawn error
      return true; 
    }

    return fs.existsSync(path.join(this.binDir, tool.exeName));
  }

  async installTool(tool: ToolDependency, sender: any): Promise<boolean> {
    if (tool.requiresManual) return true;

    try {
      this.sendProgress(sender, tool.name, 'Fetching latest release info...');
      
      const apiURL = `https://api.github.com/repos/${tool.repo}/releases/latest`;
      const response = await axios.get(apiURL);
      const version = response.data.tag_name.replace('v', '');
      const assetName = `${tool.assetPrefix}${version}${tool.assetSuffix}`;
      
      const asset = response.data.assets.find((a: any) => a.name === assetName);
      if (!asset) {
        throw new Error(`Asset ${assetName} not found in latest release.`);
      }

      this.sendProgress(sender, tool.name, `Downloading ${assetName}...`);
      
      const zipPath = path.join(this.binDir, assetName);
      await this.downloadFile(asset.browser_download_url, zipPath, (progress) => {
        this.sendProgress(sender, tool.name, `Downloading: ${Math.round(progress)}%`);
      });

      this.sendProgress(sender, tool.name, 'Extracting...');
      
      // We use extract-zip which is safe and reliable
      await extract(zipPath, { dir: this.binDir });
      
      // Cleanup zip
      await fsPromises.unlink(zipPath);
      
      this.sendProgress(sender, tool.name, 'Installed successfully.');
      return true;

    } catch (error: any) {
      logger.error(`Failed to install ${tool.name}`, error);
      this.sendProgress(sender, tool.name, `Error: ${error.message}`, true);
      return false;
    }
  }

  async checkAndInstallAll(sender: any): Promise<void> {
    for (const tool of DEPENDENCIES) {
      if (!tool.requiresManual && !this.isInstalled(tool.name)) {
        await this.installTool(tool, sender);
      }
    }
    safeSend(sender, 'dependencies:ready', { status: 'all_installed' });
  }

  private sendProgress(sender: any, tool: string, message: string, isError = false) {
    logger.info(`[Install ${tool}] ${message}`);
    safeSend(sender, 'dependency:progress', { tool, message, isError });
  }

  private async downloadFile(url: string, dest: string, onProgress: (percent: number) => void): Promise<void> {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const totalLength = response.headers['content-length'];
    let downloaded = 0;

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(dest);
      response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (totalLength) {
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
function safeSend(sender: any, channel: string, data: any) {
  if (sender && !sender.isDestroyed()) {
    sender.send(channel, data);
  }
}
