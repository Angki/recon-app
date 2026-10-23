import { exec, execSync, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../logger';
import { settingsStore } from '../settings';

export interface DockerStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  desktopExecutable?: string;
}

export class DockerService {
  /**
   * Find Docker Desktop executable on Windows
   */
  findDockerDesktopExecutable(): string | null {
    if (process.platform !== 'win32') return null;

    const candidatePaths = [
      'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'Docker Desktop.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Docker', 'Docker Desktop.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Docker', 'Docker', 'Docker Desktop.exe'),
    ];

    for (const p of candidatePaths) {
      if (p && fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Check if Docker CLI is available in PATH or settings
   */
  resolveDockerCli(): string | null {
    try {
      const configured = settingsStore.get().activeDockerPath;
      if (configured && fs.existsSync(configured)) {
        return configured;
      }
    } catch {
      // settings store might not be initialized yet in isolated tests
    }

    try {
      const cmd = process.platform === 'win32' ? 'where docker' : 'which docker';
      const out = execSync(cmd, { stdio: 'pipe', timeout: 5000 }).toString().trim();
      const first = out.split('\n')[0]?.trim();
      if (first && fs.existsSync(first)) return first;
    } catch {
      // not in PATH
    }

    if (process.platform === 'win32') {
      const defaultBin = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
      if (fs.existsSync(defaultBin)) return defaultBin;
    }

    return null;
  }

  /**
   * Check if Docker daemon is running and responsive
   */
  async isDockerRunning(dockerCliPath?: string): Promise<boolean> {
    const cli = dockerCliPath || this.resolveDockerCli() || 'docker';
    return new Promise<boolean>((resolve) => {
      exec(`"${cli}" info`, { timeout: 6000 }, (err) => {
        resolve(!err);
      });
    });
  }

  /**
   * Synchronous check if Docker daemon is responsive (for quick preflight)
   */
  isDockerRunningSync(dockerCliPath?: string): boolean {
    const cli = dockerCliPath || this.resolveDockerCli() || 'docker';
    try {
      execSync(`"${cli}" info`, { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Launch Docker Desktop executable in background
   */
  launchDockerDesktop(): boolean {
    const desktopPath = this.findDockerDesktopExecutable();
    if (!desktopPath) {
      logger.warn('Docker Desktop executable not found in standard paths.', 'DockerService');
      return false;
    }

    try {
      logger.info(`Auto-launching Docker Desktop from: ${desktopPath}`, 'DockerService');
      const child = spawn(desktopPath, [], { detached: true, stdio: 'ignore' });
      child.unref();
      return true;
    } catch (err: unknown) {
      logger.error(`Failed to launch Docker Desktop: ${err instanceof Error ? err.message : String(err)}`, 'DockerService');
      return false;
    }
  }

  /**
   * Ensure Docker daemon is running. If not, auto-launch Docker Desktop and poll until ready.
   */
  async ensureDockerReady(
    onProgress?: (msg: string) => void,
    timeoutMs = 60000
  ): Promise<{ ready: boolean; error?: string }> {
    const isRunning = await this.isDockerRunning();
    if (isRunning) {
      return { ready: true };
    }

    const desktopPath = this.findDockerDesktopExecutable();
    if (!desktopPath) {
      const errMsg = 'Docker daemon is not running and Docker Desktop executable could not be found to auto-start.';
      onProgress?.(`[-] ${errMsg}`);
      return { ready: false, error: errMsg };
    }

    onProgress?.('[*] Docker daemon is not active. Auto-starting Docker Desktop in the background...');
    const launched = this.launchDockerDesktop();
    if (!launched) {
      const errMsg = 'Failed to launch Docker Desktop process.';
      onProgress?.(`[-] ${errMsg}`);
      return { ready: false, error: errMsg };
    }

    onProgress?.('[*] Docker Desktop launched. Waiting for Docker daemon to become responsive...');

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 2500));
      const runningNow = await this.isDockerRunning();
      if (runningNow) {
        onProgress?.('[+] Docker daemon is online and responsive!');
        return { ready: true };
      }
    }

    const timeoutErrMsg = `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for Docker daemon to initialize.`;
    onProgress?.(`[-] ${timeoutErrMsg}`);
    return { ready: false, error: timeoutErrMsg };
  }

  /**
   * Get comprehensive Docker status summary
   */
  async getStatus(): Promise<DockerStatus> {
    const cli = this.resolveDockerCli();
    const desktopPath = this.findDockerDesktopExecutable();
    const running = await this.isDockerRunning(cli || undefined);

    let version: string | undefined;
    if (running && cli) {
      try {
        version = execSync(`"${cli}" version --format "{{.Server.Version}}"`, { stdio: 'pipe', timeout: 5000 }).toString().trim();
      } catch {
        // ignore
      }
    }

    return {
      installed: Boolean(cli || desktopPath),
      running,
      version,
      desktopExecutable: desktopPath || undefined
    };
  }
}

export const dockerService = new DockerService();
