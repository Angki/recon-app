import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { toolCatalog } from '../catalog';
import { toolManager } from '../toolManager';
import { pythonVenv } from './pythonVenv';
import type { PreflightSmokeResult, ToolStatus } from './types';

export class PreflightSmokeEngine {
  /**
   * Evaluates comprehensive tool status across:
   * 'not_installed' | 'installed' | 'runtime_missing' | 'unsupported_version' | 'healthcheck_failed' | 'ready'
   */
  async evaluateStatus(toolId: string): Promise<PreflightSmokeResult> {
    const startTime = Date.now();
    const manifest = toolCatalog.get(toolId);
    if (!manifest) {
      return {
        passed: false,
        status: 'not_installed',
        durationMs: Date.now() - startTime,
        details: `Unknown tool '${toolId}' not in catalog.`
      };
    }

    // 1. Resolve binary location
    const resolvedPath = toolManager.resolveToolPath(toolId);
    const isExplicitFile = path.isAbsolute(resolvedPath) && fs.existsSync(resolvedPath);

    if (!isExplicitFile) {
      // Check if runtime like Python or Docker is required
      if (manifest.runtime === 'python-pip' || manifest.runtime === 'python-script') {
        const sysPy = pythonVenv.findSystemPython();
        if (!sysPy.available) {
          return {
            passed: false,
            status: 'runtime_missing',
            durationMs: Date.now() - startTime,
            details: 'Python 3.9+ runtime missing from system. Required to run this engine.'
          };
        }
      }
      return {
        passed: false,
        status: 'not_installed',
        durationMs: Date.now() - startTime,
        details: `Binary '${manifest.installStrategy.exeName}' not found in ReconApp bin or system PATH.`
      };
    }

    // 2. Version Flag & Basic Execution Preflight
    const isBat = resolvedPath.toLowerCase().endsWith('.bat') || resolvedPath.toLowerCase().endsWith('.cmd');
    const executable = isBat ? (process.env.comspec || 'cmd.exe') : resolvedPath;
    const args = isBat ? ['/c', path.basename(resolvedPath), manifest.versionFlag] : [manifest.versionFlag];

    let output = '';
    let exitCode: number | null = null;

    try {
      await new Promise<void>((resolve) => {
        const child = spawn(executable, args, {
          cwd: path.dirname(resolvedPath),
          windowsHide: true,
          shell: false
        });

        child.stdout?.on('data', (d) => { output += d.toString(); });
        child.stderr?.on('data', (d) => { output += d.toString(); });

        const timer = setTimeout(() => {
          try { child.kill(); } catch { /* ignore */ }
          resolve();
        }, 5000);

        child.on('close', (code) => {
          clearTimeout(timer);
          exitCode = code;
          resolve();
        });

        child.on('error', () => {
          clearTimeout(timer);
          exitCode = -1;
          resolve();
        });
      });
    } catch {
      exitCode = -1;
    }

    if (exitCode === -1 || exitCode === null) {
      return {
        passed: false,
        status: 'healthcheck_failed',
        durationMs: Date.now() - startTime,
        details: `Execution error while testing ${toolId} version flag.`
      };
    }

    // Extract version
    const versionMatch = output.match(/v?(\d+\.\d+(?:\.\d+)?)/i);
    const version = versionMatch ? (versionMatch[0].startsWith('v') ? versionMatch[0] : `v${versionMatch[0]}`) : undefined;

    // Check version compatibility if minVersion is defined
    if (version && manifest.minVersion) {
      const cleanVer = version.replace(/^v/, '');
      const cleanMin = manifest.minVersion.replace(/^v/, '');
      if (this.isVersionLower(cleanVer, cleanMin)) {
        return {
          passed: false,
          status: 'unsupported_version',
          version,
          durationMs: Date.now() - startTime,
          details: `Detected version ${version} is lower than minimum required version ${manifest.minVersion}.`
        };
      }
    }

    // 3. Smoke Test Fixture execution if defined
    if (manifest.smokeArgs && manifest.smokeArgs.length > 0) {
      const smokeArgs = isBat
        ? ['/c', path.basename(resolvedPath), ...manifest.smokeArgs]
        : manifest.smokeArgs;

      let smokeExit: number | null = null;
      try {
        await new Promise<void>((resolve) => {
          const smokeProc = spawn(executable, smokeArgs, {
            cwd: path.dirname(resolvedPath),
            windowsHide: true,
            shell: false
          });
          const smokeTimer = setTimeout(() => {
            try { smokeProc.kill(); } catch { /* ignore */ }
            resolve();
          }, 8000);
          smokeProc.on('close', (code) => {
            clearTimeout(smokeTimer);
            smokeExit = code;
            resolve();
          });
          smokeProc.on('error', () => {
            clearTimeout(smokeTimer);
            smokeExit = -1;
            resolve();
          });
        });
      } catch {
        smokeExit = -1;
      }

      const expectedSmokeCode = manifest.smokeExpectedExitCode ?? 0;
      if (smokeExit !== expectedSmokeCode) {
        return {
          passed: false,
          status: 'healthcheck_failed',
          version,
          durationMs: Date.now() - startTime,
          details: `Smoke fixture test failed (exit code ${smokeExit}, expected ${expectedSmokeCode}).`
        };
      }
    }

    return {
      passed: true,
      status: 'ready',
      version,
      durationMs: Date.now() - startTime,
      details: `Tool is ready and verified (Version: ${version || 'Detected'}).`
    };
  }

  isVersionLower(v1: string, v2: string): boolean {
    const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);
    const len = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < len; i++) {
      const p1 = parts1[i] ?? 0;
      const p2 = parts2[i] ?? 0;
      if (p1 < p2) return true;
      if (p1 > p2) return false;
    }
    return false;
  }
}

export const preflightSmoke = new PreflightSmokeEngine();
