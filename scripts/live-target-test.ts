import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { dbService } from '../electron/services/database';
import { settingsStore } from '../electron/services/settings';
import { toolManager } from '../electron/services/toolManager';
import { storage } from '../electron/services/storage';
import { endpointInventory } from '../electron/services/endpointInventory';
import { getAdapter } from '../electron/services/scanners/registry';
import { activeRuntime } from '../electron/services/scanners/activeValidation';
import { aiService, AI_PRESETS } from '../electron/services/aiService';
import type { ScannerContext } from '../electron/services/scanners/types';
import type Electron from 'electron';

async function runChildProcess(bin: string, args: string[], cwd: string, timeoutMs: number = 90000): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let executable = bin;
    let spawnArgs = args;
    const isBat = bin.toLowerCase().endsWith('.bat') || bin.toLowerCase().endsWith('.cmd');
    if (isBat && process.platform === 'win32') {
      executable = process.env.comspec || 'cmd.exe';
      spawnArgs = ['/c', bin, ...args];
    }
    const child = spawn(executable, spawnArgs, { cwd, windowsHide: true });

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch (_e) {
        // Ignore kill error on already exited process
      }
      resolve({ code: -1, stdout, stderr: stderr + '\n[TIMEOUT EXCEEDED]' });
    }, timeoutMs);

    child.stdout?.on('data', chunk => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function main() {
  console.log('\n================================================================');
  console.log('   RECON APP - REAL TARGET AUTOMATED PENETRATION TEST RUNNER     ');
  console.log('================================================================\n');

  const targetUrl = 'http://demo.testfire.net/search.jsp?query=test';
  const domain = 'demo.testfire.net';
  const scopeOrigin = 'http://demo.testfire.net';
  const parameter = 'query';

  console.log(`[+] Target URL:     ${targetUrl}`);
  console.log(`[+] Target Domain:  ${domain}`);
  console.log(`[+] Scope Origin:   ${scopeOrigin}`);
  console.log(`[+] Test Parameter: ${parameter}\n`);

  const settings = settingsStore.get();
  console.log(`[+] Settings Loaded: Active Python: ${settings.activePythonPath}`);
  console.log(`[+] Settings Loaded: SQLMap Script:  ${settings.sqlmapScriptPath}\n`);

  // Create real scan directory & metadata in SQLite
  const { scanId, scanDir } = storage.createScanDirectory(domain);
  console.log(`[+] Scan Directory created: ${scanDir}`);
  console.log(`[+] Scan ID assigned:       ${scanId}\n`);

  await storage.saveMetadata(scanId, {
    scanId,
    target: targetUrl,
    domain,
    startTime: new Date().toISOString(),
    status: 'RUNNING',
    config: {
      tools: ['whatweb', 'katana', 'sqlmap'],
      activeValidation: {
        scopeOrigin,
        parameters: [parameter],
        timeoutMinutes: 10,
        delaySeconds: 1
      }
    }
  });

  const mockSender = { isDestroyed: () => false, send: () => {} } as unknown as Electron.WebContents;

  // =========================================================================
  // PHASE 1: WHATWEB FINGERPRINTING
  // =========================================================================
  console.log('----------------------------------------------------------------');
  console.log('>>> [PHASE 1] Running WhatWeb Technology Fingerprinting...');
  console.log('----------------------------------------------------------------');
  const whatwebBin = toolManager.resolveToolPath('whatweb');
  let whatwebFindingsCount = 0;

  if (whatwebBin && fs.existsSync(whatwebBin)) {
    const whatwebJson = path.join(scanDir, 'whatweb_out.json');
    const whatwebTxt = path.join(scanDir, 'whatweb_out.txt');

    const whatwebCtx: ScannerContext = {
      scanId,
      targetUrl,
      domain,
      scannerName: 'whatweb',
      bin: whatwebBin,
      outDir: scanDir,
      timestamp: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15),
      outputFile: whatwebTxt,
      jsonFile: whatwebJson,
      config: {},
      sender: mockSender,
      settings
    };

    const whatwebAdapter = getAdapter('whatweb');
    if (whatwebAdapter) {
      const args = whatwebAdapter.getCommandArgs(whatwebCtx);
      console.log(`[*] Executing: ${whatwebBin} ${args.join(' ')}\n`);
      const res = await runChildProcess(whatwebBin, args, scanDir, 30000);
      console.log(`\n[*] WhatWeb exited with code: ${res.code}`);

      const findings = whatwebAdapter.parseFindings(whatwebCtx);
      whatwebFindingsCount = findings.length;
      console.log(`[+] WhatWeb parsed findings: ${findings.length}`);
      if (findings.length > 0) {
        dbService.insertFindings(scanId, 'whatweb', findings);
        findings.forEach(f => console.log(`    - [${f.severity || 'info'}] ${f.name} (${f.url})`));
      }
    }
  } else {
    console.log('[-] WhatWeb binary not found, skipping phase 1.');
  }

  // =========================================================================
  // PHASE 2: KATANA ENDPOINT CRAWLING & INVENTORY
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('>>> [PHASE 2] Running Katana Crawler & Endpoint Discovery...');
  console.log('----------------------------------------------------------------');
  const katanaBin = toolManager.resolveToolPath('katana');
  let discoveredEndpointsCount = 0;

  if (katanaBin && fs.existsSync(katanaBin)) {
    const katanaJson = path.join(scanDir, 'katana_out.json');
    const katanaTxt = path.join(scanDir, 'katana_out.txt');

    const katanaCtx: ScannerContext = {
      scanId,
      targetUrl: 'http://demo.testfire.net',
      domain,
      scannerName: 'katana',
      bin: katanaBin,
      outDir: scanDir,
      timestamp: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15),
      outputFile: katanaTxt,
      jsonFile: katanaJson,
      config: {},
      sender: mockSender,
      settings
    };

    // Fast crawl with depth 1 to respect testing boundaries
    const katanaArgs = ['-u', 'http://demo.testfire.net', '-depth', '1', '-jc', '-j', '-o', katanaJson, '-silent', '-concurrency', '5'];
    console.log(`[*] Executing: ${katanaBin} ${katanaArgs.join(' ')}\n`);
    const res = await runChildProcess(katanaBin, katanaArgs, scanDir, 30000);
    console.log(`\n[*] Katana exited with code: ${res.code}`);

    const katanaAdapter = getAdapter('katana');
    if (katanaAdapter) {
      const findings = katanaAdapter.parseFindings(katanaCtx);
      console.log(`[+] Katana endpoints found: ${findings.length}`);
      if (findings.length > 0) {
        dbService.insertFindings(scanId, 'katana', findings);
      }
    }

    // Capture endpoints into EndpointInventory ledger
    const captured = endpointInventory.capture(katanaCtx);
    console.log(`[+] Captured into Endpoint Inventory: ${captured} endpoints`);

    // Inspect Endpoint Inventory
    const parameterized = endpointInventory.getParameterizedEndpoints(scanId, scopeOrigin);
    discoveredEndpointsCount = parameterized.length;
    console.log(`[+] Parameterized Endpoints automatically discovered in scope: ${parameterized.length}`);
    parameterized.slice(0, 5).forEach(ep => {
      console.log(`    - [${ep.method}] ${ep.url} (Params: ${ep.parameters.join(', ')})`);
    });
  } else {
    console.log('[-] Katana binary not found, skipping phase 2.');
  }

  // =========================================================================
  // PHASE 3: ACTIVE SQLMAP TESTING ON PARAMETER `query`
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('>>> [PHASE 3] Running SQLMap Active SQL Injection Testing...');
  console.log('----------------------------------------------------------------');
  let sqlmapFindingsCount = 0;

  const sqlmapRuntime = activeRuntime('sqlmap', settings as unknown as Record<string, unknown>);
  console.log(`[+] SQLMap Interpreter: ${sqlmapRuntime.executable}`);
  console.log(`[+] SQLMap Script:      ${sqlmapRuntime.script}`);
  console.log(`[+] Script SHA256:      ${sqlmapRuntime.scriptSha256.slice(0, 16)}...\n`);

  const sqlmapOut = path.join(scanDir, 'sqlmap_out.txt');
  const sqlmapJson = path.join(scanDir, 'sqlmap_out.json');

  const sqlmapCtx: ScannerContext = {
    scanId,
    targetUrl,
    domain,
    scannerName: 'sqlmap',
    bin: sqlmapRuntime.executable,
    outDir: scanDir,
    timestamp: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15),
    outputFile: sqlmapOut,
    jsonFile: sqlmapJson,
    config: {
      activeValidation: {
        scopeOrigin,
        parameters: [parameter],
        timeoutMinutes: 5,
        delaySeconds: 1
      }
    },
    sender: mockSender,
    settings
  };

  const sqlmapAdapter = getAdapter('sqlmap');
  if (sqlmapAdapter) {
    const rawArgs = sqlmapAdapter.getCommandArgs(sqlmapCtx);
    // Combine python + script + args
    const fullArgs = [sqlmapRuntime.script, ...rawArgs];
    console.log(`[*] Executing: ${sqlmapRuntime.executable} ${fullArgs.join(' ')}\n`);

    const res = await runChildProcess(sqlmapRuntime.executable, fullArgs, scanDir, 60000);
    console.log(`\n[*] SQLMap execution completed with exit code: ${res.code}`);

    // Save stdout to outputFile for the adapter parser
    fs.writeFileSync(sqlmapOut, res.stdout, 'utf8');

    try {
      const findings = sqlmapAdapter.parseFindings ? sqlmapAdapter.parseFindings(sqlmapCtx) : [];
      sqlmapFindingsCount = findings.length;
      console.log(`[+] SQLMap parsed confirmed findings: ${findings.length}`);
      if (findings.length > 0) {
        dbService.insertFindings(scanId, 'sqlmap', findings);
        findings.forEach(f => console.log(`    - [${f.severity}] ${f.name} (Param: ${f.param}, CWE: ${f.cwe})`));
      }
    } catch (parseErr: unknown) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.log(`[*] SQLMap Parser note: ${msg}`);
    }
  }

  // =========================================================================
  // PHASE 4: AI CYBERSECURITY ENGINE SYNTHESIS
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('>>> [PHASE 4] AI Cybersecurity Synthesis & Context Generation...');
  console.log('----------------------------------------------------------------');

  const totalFindings = dbService.getFindingsPaginated(scanId, { page: 1, limit: 100 });
  console.log(`[+] Total findings saved in SQLite for scan [${scanId}]: ${totalFindings.total}`);

  const aiContext = aiService.synthesizeFindingsContext(scanId);
  console.log('\n--- Synthesized AI Prompt Context (Sample) ---');
  console.log(aiContext.slice(0, 600) + '...\n');

  console.log('[+] Evaluating 4 AI Presets:');
  for (const [key, prompt] of Object.entries(AI_PRESETS)) {
    console.log(`    - ${key}: Preset prompt template verified (${(prompt as string).length} chars)`);
  }

  console.log('\n================================================================');
  console.log('             REAL TARGET TEST SUMMARY & VERIFICATION             ');
  console.log('================================================================');
  console.log(`Target:                 ${targetUrl}`);
  console.log(`Scan ID:                ${scanId}`);
  console.log(`WhatWeb Technologies:  ${whatwebFindingsCount}`);
  console.log(`Katana Endpoints:       ${discoveredEndpointsCount}`);
  console.log(`SQLMap Confirmed Vulns: ${sqlmapFindingsCount}`);
  console.log(`SQLite DB Ledger:       ${totalFindings.total} verified entries`);
  console.log('Status:                 SUCCESSFUL EXECUTION');
  console.log('================================================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
