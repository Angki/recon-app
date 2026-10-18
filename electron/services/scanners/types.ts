import type { ChildProcess } from 'child_process';
import type Electron from 'electron';
import type { AppSettings } from '../settings';

export interface ScannerContext {
  scanId: string;
  targetUrl: string;
  domain: string;
  scannerName: string;
  bin: string;
  outDir: string;
  config?: Record<string, unknown>;
  timestamp: string;
  outputFile: string;
  jsonFile: string;
  xmlFile: string;
  sender: Electron.WebContents;
  settings: AppSettings | Record<string, unknown>;
}

export interface IScannerAdapter {
  getCommandArgs(context: ScannerContext): string[];
  
  getEnv?(context: ScannerContext, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
  
  getProcessOptions?(context: ScannerContext, defaultOptions: { executable: string, args: string[], useShell: boolean, cwd: string }): { executable: string, args: string[], useShell: boolean, cwd: string };

  handleStdin?(context: ScannerContext, processInstance: ChildProcess): void;

  processStdout?(context: ScannerContext, msg: string, stats: Record<string, Record<string, number>>): void;

  parseFindings?(context: ScannerContext): Record<string, unknown>[];

  isSuccessExitCode?(code: number | null, context?: ScannerContext): boolean;
}
