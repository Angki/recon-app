import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { settingsStore } from '../settings';

export class PythonVenvManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(os.homedir(), 'AppData', 'Roaming', 'ReconApp', 'bin');
  }

  setBaseDir(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Discovers a valid Python 3.9+ interpreter across system standard locations without relying on private paths.
   */
  findSystemPython(): { available: boolean; path?: string; version?: string } {
    // 1. Check user configured settings path first
    const settings = settingsStore.get();
    if (settings.activePythonPath && fs.existsSync(settings.activePythonPath)) {
      const ver = this.checkPythonVersion(settings.activePythonPath);
      if (ver) return { available: true, path: settings.activePythonPath, version: ver };
    }

    // 2. Candidate commands and system paths
    const candidates = [
      'python',
      'python3',
      'py',
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python313', 'python.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'python.exe'),
      'C:\\Python313\\python.exe',
      'C:\\Python312\\python.exe',
      'C:\\Python311\\python.exe'
    ];

    for (const cand of candidates) {
      try {
        const cmd = process.platform === 'win32' && !path.isAbsolute(cand) ? `where ${cand}` : (process.platform !== 'win32' && !path.isAbsolute(cand) ? `which ${cand}` : cand);
        const resolved = path.isAbsolute(cmd)
          ? (fs.existsSync(cmd) ? cmd : null)
          : execSync(cmd, { stdio: 'pipe' }).toString().trim().split('\n')[0].trim();

        if (resolved && fs.existsSync(resolved)) {
          const ver = this.checkPythonVersion(resolved);
          if (ver) return { available: true, path: resolved, version: ver };
        }
      } catch {
        // Continue search
      }
    }

    return { available: false };
  }

  private checkPythonVersion(executable: string): string | null {
    try {
      const output = execSync(`"${executable}" --version`, { stdio: 'pipe', timeout: 4000 }).toString().trim();
      const match = output.match(/Python\s+(\d+\.\d+\.\d+)/i);
      return match ? match[1] : output;
    } catch {
      return null;
    }
  }

  getVenvRoot(): string {
    return path.resolve(this.baseDir, 'venvs');
  }

  getVenvDir(toolName: string): string {
    if (
      typeof toolName !== 'string' ||
      !toolName.trim() ||
      toolName.includes('..') ||
      toolName.includes('/') ||
      toolName.includes('\\') ||
      toolName.includes('\0')
    ) {
      throw new Error(`Invalid tool id for virtualenv path: '${String(toolName)}'.`);
    }
    const root = this.getVenvRoot();
    const target = path.resolve(root, toolName);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Refusing to resolve virtualenv outside the managed root: '${toolName}'.`);
    }
    return target;
  }

  getVenvPython(toolName: string): string {
    const venv = this.getVenvDir(toolName);
    return process.platform === 'win32'
      ? path.join(venv, 'Scripts', 'python.exe')
      : path.join(venv, 'bin', 'python');
  }

  getVenvExecutable(toolName: string, exeName: string): string {
    const venv = this.getVenvDir(toolName);
    return process.platform === 'win32'
      ? path.join(venv, 'Scripts', exeName.endsWith('.exe') ? exeName : `${exeName}.exe`)
      : path.join(venv, 'bin', exeName);
  }

  /**
   * Ensures an isolated virtualenv exists for the specified tool.
   */
  async ensureVenv(toolName: string, sendOutput?: (msg: string) => void): Promise<{ venvDir: string; pythonPath: string }> {
    const venvDir = this.getVenvDir(toolName);
    const pythonPath = this.getVenvPython(toolName);

    if (fs.existsSync(pythonPath)) {
      return { venvDir, pythonPath };
    }

    const sysPy = this.findSystemPython();
    if (!sysPy.available || !sysPy.path) {
      throw new Error('No Python 3.9+ interpreter found on the system. Please install Python to enable this tool.');
    }

    if (sendOutput) sendOutput(`[*] Creating isolated virtualenv for ${toolName} using ${sysPy.path} (${sysPy.version})...`);
    fs.mkdirSync(path.dirname(venvDir), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const child = spawn(sysPy.path!, ['-m', 'venv', venvDir], {
        windowsHide: true,
        stdio: 'pipe'
      });
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(pythonPath)) resolve();
        else reject(new Error(`Failed to create virtual environment for ${toolName} (exit code ${code})`));
      });
      child.on('error', reject);
    });

    if (sendOutput) sendOutput(`[+] Virtual environment created at ${venvDir}`);
    return { venvDir, pythonPath };
  }

  /**
   * Installs or upgrades a Python package strictly inside the tool's dedicated virtualenv.
   */
  async installInVenv(
    toolName: string,
    packageName: string,
    pinnedVersion?: string,
    sendOutput?: (msg: string) => void
  ): Promise<boolean> {
    const { venvDir } = await this.ensureVenv(toolName, sendOutput);
    const pipPath = process.platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'pip.exe')
      : path.join(venvDir, 'bin', 'pip');

    const pkgSpec = pinnedVersion ? `${packageName}==${pinnedVersion}` : packageName;
    if (sendOutput) sendOutput(`[+] Installing ${pkgSpec} in isolated venv...`);

    return new Promise((resolve) => {
      const child = spawn(pipPath, ['install', '--upgrade', pkgSpec], {
        windowsHide: true,
        cwd: venvDir
      });

      child.stdout?.on('data', (d) => {
        if (sendOutput) sendOutput(d.toString().trim());
      });
      child.stderr?.on('data', (d) => {
        if (sendOutput) sendOutput(d.toString().trim());
      });

      child.on('close', (code) => {
        resolve(code === 0);
      });
      child.on('error', () => {
        resolve(false);
      });
    });
  }
}

export const pythonVenv = new PythonVenvManager();
