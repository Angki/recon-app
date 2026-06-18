import { ChildProcess } from 'child_process';
import Electron from 'electron';

export interface ScannerContext {
  scanId: string;
  targetUrl: string;
  domain: string;
  scannerName: string;
  bin: string;
  outDir: string;
  config?: any;
  timestamp: string;
  outputFile: string;
  jsonFile: string;
  xmlFile: string;
  sender: Electron.WebContents;
  settings: any;
}

export interface IScannerAdapter {
  getCommandArgs(context: ScannerContext): string[];
  
  getEnv?(context: ScannerContext, env: any): any;
  
  getProcessOptions?(context: ScannerContext, defaultOptions: { executable: string, args: string[], useShell: boolean, cwd: string }): { executable: string, args: string[], useShell: boolean, cwd: string };

  handleStdin?(context: ScannerContext, processInstance: ChildProcess): void;

  processStdout?(context: ScannerContext, msg: string, stats: any): void;

  parseFindings?(context: ScannerContext): any[];
}
