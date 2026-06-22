import { spawn } from 'child_process';
import { logger } from './logger';
import { settingsStore } from './settings';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class UpdaterService {
  async updateTools(sender: Electron.WebContents) {
    const sendOutput = (msg: string) => {
      logger.info(msg, 'Updater');
      sender.send('update:output', msg);
    };

    sendOutput('[*] Starting tools update process...');

    try {
      const settings = settingsStore.get();
      
      const resolveTool = (name: string, settingPath: string | undefined) => {
        if (settingPath) return settingPath;
        if (process.platform === 'win32' && ['httpx', 'subfinder', 'nuclei'].includes(name)) {
          const goPath = path.join(os.homedir(), 'go', 'bin', `${name}.exe`);
          if (fs.existsSync(goPath)) return goPath;
        }
        return name;
      };

      const nucleiBin = resolveTool('nuclei', settings.nucleiPath);

      const subfinderBin = resolveTool('subfinder', settings.subfinderPath);
      const httpxBin = resolveTool('httpx', settings.httpxPath);

      // 1. Update Nuclei Engine
      sendOutput('[+] Updating Nuclei Engine...');
      await this.runCommand(nucleiBin, ['-update'], sendOutput);

      // 2. Update Nuclei Templates
      sendOutput('[+] Updating Nuclei Templates...');
      await this.runCommand(nucleiBin, ['-update-templates'], sendOutput);

      // 3. Update Wapiti
      sendOutput('[+] Updating Wapiti via pip...');
      await this.runCommand('pip', ['install', '--upgrade', 'wapiti3'], sendOutput);

      // 4. Update subfinder
      sendOutput('[+] Updating Subfinder...');
      await this.runCommand(subfinderBin, ['-update'], sendOutput);

      // 5. Update httpx
      sendOutput('[+] Updating httpx...');
      await this.runCommand(httpxBin, ['-update'], sendOutput);

      sendOutput('[*] Tools update completed successfully.');
      sender.send('update:status', 'DONE');
    } catch (err: unknown) {
      sendOutput(`[-] Error during update: ${(err as Error).message}`);
      sender.send('update:status', 'ERROR');
    }
  }

  private runCommand(command: string, args: string[], sendOutput: (msg: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { shell: true });

      proc.stdout.on('data', (data) => {
        sendOutput(data.toString().trim());
      });

      proc.stderr.on('data', (data) => {
        sendOutput(data.toString().trim());
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Command ${command} failed with exit code ${code}`));
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}

export const updaterService = new UpdaterService();
