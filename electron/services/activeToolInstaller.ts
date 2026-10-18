import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { settingsStore } from './settings';

export const PINNED_ACTIVE_SOURCES = {
  sqlmap: {repo:'https://github.com/sqlmapproject/sqlmap.git',revision:'9a1660aa120c526f68b637e5f232137722353522',script:'sqlmap.py',setting:'sqlmapScriptPath'},
  commix: {repo:'https://github.com/commixproject/commix.git',revision:'287fb3dc99ff0c720cd1e5327ddb9819d8f5c5b8',script:'commix.py',setting:'commixScriptPath'},
} as const;
export const PINNED_NIKTO_IMAGE = 'ghcr.io/sullo/nikto@sha256:0bb37022ebfadc38d6a9a2755c03bfd1f9e079e01e8946fe548153d9ba0c2012';
export type InstallableActiveTool = keyof typeof PINNED_ACTIVE_SOURCES | 'nikto';
const execute = promisify(execFile);
const installing = new Set<string>();
export function supportsActiveInstall(tool: string): tool is InstallableActiveTool {
  return tool === 'nikto' || Object.hasOwn(PINNED_ACTIVE_SOURCES,tool);
}

// Never overwrite a caller's checkout. Activate settings only after checkout and runtime checks.
export async function installActiveTool(tool: InstallableActiveTool, progress: (message:string)=>void) {
  if (!supportsActiveInstall(tool)) throw new Error('Unsupported managed tool');
  if (installing.has(tool)) throw new Error('Installation already running for this tool');
  installing.add(tool);
  try {
    if (tool === 'nikto') {
      const docker = settingsStore.get().activeDockerPath || (process.platform === 'win32' ? 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' : '/usr/bin/docker');
      if (!path.isAbsolute(docker) || !(await fs.stat(docker)).isFile()) throw new Error('Install/start Docker Desktop and configure its executable in Active Testing.');
      progress('Pulling official Nikto image pinned by digest...');
      await execute(docker,['pull',PINNED_NIKTO_IMAGE],{windowsHide:true,timeout:300000,maxBuffer:4*1024*1024});
      const {stdout} = await execute(docker,['run','--rm','--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=128','--memory=512m','--cpus=1',PINNED_NIKTO_IMAGE,'-Version'],{windowsHide:true,timeout:30000});
      if (!/Nikto\s+[\d.]+/.test(stdout)) throw new Error('Nikto version check failed');
      settingsStore.save({niktoRuntime:'docker',activeDockerPath:docker,niktoDockerImage:PINNED_NIKTO_IMAGE});
      progress('Nikto Docker installed and configured.');
      return true;
    }
    const source = PINNED_ACTIVE_SOURCES[tool];
    const configured = settingsStore.get().activePythonPath;
    const candidates = [configured,
      path.join(os.homedir(),'AppData','Local','Programs','Python','Python312','python.exe'),
      'C:\\Python314\\python.exe',
      ...(process.platform !== 'win32' ? ['/usr/bin/python3','/usr/local/bin/python3'] : [])].filter(Boolean) as string[];
    let python = '';
    for (const candidate of candidates) {
      if (!path.isAbsolute(candidate)) continue;
      try {
        const {stdout} = await execute(candidate,['-c','import sys; print(sys.version_info >= (3, 8))'],{windowsHide:true,timeout:10000});
        if (stdout.trim() === 'True') {python=candidate; break;}
      } catch { /* Try another installed interpreter. */ }
    }
    if (!python) throw new Error('Python 3.8+ is required. Set its absolute executable path in Active Testing, then retry.');
    if (tool === 'commix' && process.platform === 'win32') {
      progress('Installing pinned Windows readline dependency (pyreadline3 3.5.6)...');
      await execute(python,['-m','pip','install','--user','--disable-pip-version-check','pyreadline3==3.5.6'],{windowsHide:true,timeout:180000,maxBuffer:1024*1024});
      await execute(python,['-c','import pyreadline3'],{windowsHide:true,timeout:10000});
    }
    const root = path.join(os.homedir(),'AppData','Roaming','ReconApp','tools');
    await fs.mkdir(root,{recursive:true});
    const directory = await fs.mkdtemp(path.join(root,`${tool}-managed-`));
    const run = (args:string[]) => execute('git',args,{windowsHide:true,timeout:180000,maxBuffer:1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
    progress(`Fetching official ${tool} revision ${source.revision}...`);
    await run(['init',directory]);
    await run(['-C',directory,'fetch','--depth','1',source.repo,source.revision]);
    await run(['-C',directory,'-c','core.hooksPath=','checkout','--detach','FETCH_HEAD']);
    const {stdout:head} = await run(['-C',directory,'rev-parse','HEAD']);
    if (head.trim() !== source.revision) throw new Error('Source revision mismatch');
    const script = path.join(directory,source.script);
    const {stdout:version} = await execute(python,[script,'--version'],{windowsHide:true,timeout:20000,maxBuffer:64*1024});
    if (!/\d+\.\d+/.test(version)) throw new Error('Tool version check failed');
    await fs.writeFile(path.join(directory,'recon-install.json'),JSON.stringify({tool,repo:source.repo,revision:source.revision,python,version:version.trim(),installedAt:new Date().toISOString()},null,2));
    settingsStore.save({activePythonPath:python,[source.setting]:script});
    progress(`${tool} installed and configured: ${version.trim().split('\n')[0]}`);
    return true;
  } finally { installing.delete(tool); }
}
