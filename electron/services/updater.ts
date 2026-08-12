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
        if (process.platform === 'win32' && ['httpx', 'subfinder', 'nuclei', 'alterx', 'dnsx', 'naabu', 'tlsx', 'katana'].includes(name)) {
          const goPath = path.join(os.homedir(), 'go', 'bin', `${name}.exe`);
          if (fs.existsSync(goPath)) return goPath;
        }
        return name;
      };

      const nucleiBin = resolveTool('nuclei', settings.nucleiPath);
      const subfinderBin = resolveTool('subfinder', settings.subfinderPath);
      const httpxBin = resolveTool('httpx', settings.httpxPath);
      const alterxBin = resolveTool('alterx', settings.alterxPath);
      const dnsxBin = resolveTool('dnsx', settings.dnsxPath);
      const naabuBin = resolveTool('naabu', settings.naabuPath);
      const tlsxBin = resolveTool('tlsx', settings.tlsxPath);
      const katanaBin = resolveTool('katana', settings.katanaPath);

      const updateTool = async (step: string, command: string, args: string[]) => {
        sendOutput(`[+] ${step}...`);
        try {
          await this.runCommand(command, args, sendOutput);
          sendOutput(`[+] Successfully updated: ${step}`);
        } catch (e: any) {
          sendOutput(`[-] Error updating ${step}: ${e.message}`);
        }
      };

      await updateTool('Updating Nuclei Engine', nucleiBin, ['-update']);
      await updateTool('Updating Nuclei Templates', nucleiBin, ['-update-templates']);
      await updateTool('Updating Wapiti via pip', 'pip', ['install', '--upgrade', 'wapiti3']);
      await updateTool('Updating Subfinder', subfinderBin, ['-update']);
      await updateTool('Updating httpx', httpxBin, ['-update']);
      await updateTool('Updating Alterx', alterxBin, ['-update']);
      await updateTool('Updating dnsx', dnsxBin, ['-update']);
      await updateTool('Updating Naabu', naabuBin, ['-update']);
      await updateTool('Updating tlsx', tlsxBin, ['-update']);
      await updateTool('Updating Katana', katanaBin, ['-update']);

      sendOutput('[*] Tools update completed.');
      sender.send('update:status', 'DONE');
    } catch (err: unknown) {
      sendOutput(`[-] Critical error during update: ${(err as Error).message}`);
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
