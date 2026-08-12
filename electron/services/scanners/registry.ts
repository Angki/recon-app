import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { IScannerAdapter, ScannerContext } from './types';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '../logger';

export const ScannerAdapters: Record<string, IScannerAdapter> = {
  nuclei: {
    getCommandArgs(ctx) {
      const args = ['-u', ctx.targetUrl, '-severity', 'info,low,medium,high,critical', '-stats', '-duc', '-ni', '-o', ctx.outputFile, '-je', ctx.jsonFile];
      if (ctx.config?.isWordpress) {
        args.splice(2, 0, '-tags', 'wordpress,wp-plugin,wp-theme');
      }
      if (ctx.settings.nucleiTemplatesPath) {
        args.push('-t', ctx.settings.nucleiTemplatesPath as string);
      }
      return args;
    },
    processStdout(ctx, msg, stats) {
      // eslint-disable-next-line no-control-regex
      const cleanMsg = msg.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      const lines = cleanMsg.split('\n');
      for (const line of lines) {
        const sev = line.match(/\[(info|low|medium|high|critical)\]/i);
        if (sev && !line.includes('[WRN]') && !line.includes('[DBG]') && !line.includes('[VER]')) {
          const key = sev[1].toLowerCase() as keyof typeof stats.nuclei;
          if (stats.nuclei[key] !== undefined) stats.nuclei[key]++;
        }
      }
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          findings.push({
            id: data['template-id'] || 'nuclei-finding',
            name: data.info?.name || 'Unknown',
            severity: data.info?.severity || 'info',
            scanner: 'nuclei',
            url: data['matched-at'] || data.host || '',
            description: data.info?.description || '',
            timestamp: data.timestamp || new Date().toISOString(),
            extractedResults: data['extracted-results'] || [],
            curlCommand: data['curl-command'] || '',
            references: data.info?.reference || []
          });
        } catch { /* ignore parse error for a single line */ }
      }
      return findings;
    }
  },

  wapiti: {
    getCommandArgs(ctx) {
      return [
        '-u', ctx.targetUrl,
        '-l', '2',
        '-v', '2',
        '-f', 'json',
        '-dr', '2',
        '-o', ctx.jsonFile,
        '--flush-session',
        '--store-session', ctx.outDir,
        '--no-bugreport'
      ];
    },
    getEnv(ctx, env) {
      return { ...env, PYTHONIOENCODING: 'utf-8' };
    },
    processStdout(ctx, msg, stats) {
      // eslint-disable-next-line no-control-regex
      const cleanMsg = msg.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
      const urlsMatch = cleanMsg.match(/found (\d+) URLs/);
      if (urlsMatch) {
        stats.wapiti.pages = parseInt(urlsMatch[1]);
      }
      if (cleanMsg.includes('vulnerability found in')) {
        stats.wapiti.vulns++;
      } else {
        const vulnPatterns = [/\[\+\] .*vulnerability found/, /\[!!\]/];
        for (const pat of vulnPatterns) {
          if (pat.test(cleanMsg) && !cleanMsg.includes('vulnerability found in')) {
            stats.wapiti.vulns++;
            break;
          }
        }
      }
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const data = JSON.parse(content);
      const findings: Record<string, unknown>[] = [];
      if (data.vulnerabilities) {
        for (const [vulnType, vulns] of Object.entries(data.vulnerabilities)) {
          const vulnArray = vulns as Array<{ level?: number, path?: string, info?: string, http_request?: string, curl_command?: string, parameter?: string }>;
          for (const v of vulnArray) {
            findings.push({
              id: vulnType,
              name: vulnType,
              severity: v.level === 1 ? 'low' : v.level === 2 ? 'medium' : 'high',
              scanner: 'wapiti',
              url: v.path || '',
              description: v.info || '',
              timestamp: new Date().toISOString(),
              httpRequest: v.http_request || '',
              curlCommand: v.curl_command || '',
              parameter: v.parameter || ''
            });
          }
        }
      }
      return findings;
    }
  },

  subfinder: {
    getCommandArgs(ctx) {
      return ['-d', ctx.domain, '-silent', '-json', '-o', ctx.jsonFile];
    },
    parseFindings: genericJsonLinesParser
  },
  alterx: {
    getCommandArgs(ctx) { return ['-silent', '-o', ctx.outputFile]; },
    handleStdin(ctx, proc) { proc.stdin?.write(ctx.domain + '\n'); },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.outputFile)) return [];
      const content = fs.readFileSync(ctx.outputFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim() !== '');
      if (lines.length > 0) {
        return [{
          id: 'alterx-findings',
          name: 'Alterx Permutations',
          severity: 'info',
          scanner: 'alterx',
          url: '',
          description: `Generated ${lines.length} domain permutations.`,
          timestamp: new Date().toISOString(),
        }];
      }
      return [];
    }
  },
  dnsx: {
    getCommandArgs(ctx) { return ['-silent', '-json', '-o', ctx.jsonFile]; },
    handleStdin(ctx, proc) { proc.stdin?.write(ctx.domain + '\n'); },
    parseFindings: genericJsonLinesParser
  },
  naabu: {
    getCommandArgs(ctx) { return ['-host', ctx.domain, '-top-ports', '100', '-silent', '-json', '-o', ctx.jsonFile]; },
    parseFindings: genericJsonLinesParser
  },
  tlsx: {
    getCommandArgs(ctx) { return ['-u', ctx.domain, '-silent', '-json', '-o', ctx.jsonFile]; },
    parseFindings: genericJsonLinesParser
  },
  httpx: {
    getCommandArgs(ctx) { return ['-u', ctx.targetUrl, '-title', '-tech-detect', '-status-code', '-silent', '-json', '-o', ctx.jsonFile]; },
    parseFindings: genericJsonLinesParser
  },
  nmap: {
    getCommandArgs(ctx) { return ['-sV', '-sC', ctx.domain, '-oN', ctx.outputFile]; },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.outputFile)) return [];
      const content = fs.readFileSync(ctx.outputFile, 'utf-8');
      const openPorts = content.split('\n').filter(l => l.includes(' open '));
      if (openPorts.length > 0) {
        return [{
          id: 'nmap-open-ports',
          name: 'Nmap Open Ports',
          severity: 'medium',
          scanner: 'nmap',
          url: '',
          description: openPorts.join('\n'),
          timestamp: new Date().toISOString(),
        }];
      }
      return [];
    }
  },
  zap: {
    getCommandArgs(ctx) {
      const zapHome = path.join(ctx.outDir, `zap_home_${ctx.timestamp}`);
      if (!fs.existsSync(zapHome)) fs.mkdirSync(zapHome, { recursive: true });
      return ['-cmd', '-quickurl', ctx.targetUrl, '-quickout', ctx.jsonFile, '-quickprogress', '-dir', zapHome];
    },
    getProcessOptions(ctx, opts) {
      const cwd = path.dirname(ctx.bin);
      const isBat = ctx.bin.toLowerCase().endsWith('.bat') || ctx.bin.toLowerCase().endsWith('.cmd');
      const executable = isBat ? path.basename(ctx.bin) : ctx.bin;
      
      let spawnExecutable = executable;
      let spawnArgs = opts.args;
      let useShell = opts.useShell;
      
      if (isBat && process.platform === 'win32') {
        spawnExecutable = process.env.comspec || 'cmd.exe';
        spawnArgs = ['/c', executable, ...opts.args];
        useShell = false;
      } else if (isBat) {
        useShell = true;
      }
      return { executable: spawnExecutable, args: spawnArgs, useShell, cwd };
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const data = JSON.parse(content);
      const findings: Record<string, unknown>[] = [];
      const site = data?.site?.[0];
      if (site && site.alerts) {
        for (const alert of site.alerts) {
          findings.push({
            id: alert.pluginid || 'zap-alert',
            name: alert.name || 'ZAP Finding',
            severity: alert.riskdesc?.toLowerCase().includes('high') ? 'high' : 
                      alert.riskdesc?.toLowerCase().includes('medium') ? 'medium' :
                      alert.riskdesc?.toLowerCase().includes('low') ? 'low' : 'info',
            scanner: 'zap',
            url: alert.instances?.[0]?.uri || site['@name'] || '',
            description: alert.desc || '',
            timestamp: new Date().toISOString(),
          });
        }
      }
      return findings;
    }
  },
  wpscan: {
    getCommandArgs(ctx) {
      const args = [
        'run', '--rm', 
        '-v', `${ctx.outDir}:/mnt`, 
        'wpscanteam/wpscan', 
        '--url', ctx.targetUrl, 
        '-f', 'cli-no-color',
        '-f', 'json', 
        '-o', `/mnt/${path.basename(ctx.jsonFile)}`,
        '--random-user-agent',
        '--force',
        '--disable-tls-checks'
      ];
      if (ctx.settings.wpscanApiToken) {
        args.push('--api-token', ctx.settings.wpscanApiToken as string);
      }
      return args;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      try {
        const data = JSON.parse(content);
        const findings: Record<string, unknown>[] = [];
        
        if (data.scan_aborted) {
          findings.push({
            id: 'wpscan-aborted',
            name: 'Scan Aborted',
            severity: 'info',
            scanner: 'wpscan',
            url: data.target_url || '',
            description: data.scan_aborted,
            timestamp: new Date().toISOString()
          });
        }
        if (data.interesting_findings) {
          data.interesting_findings.forEach((finding: { type?: string, to_s?: string, url?: string, interesting_entries?: string[] }) => {
            findings.push({
              id: finding.type || finding.to_s || 'Interesting Finding',
              name: finding.type || finding.to_s || 'Interesting Finding',
              severity: 'info',
              scanner: 'wpscan',
              url: finding.url || '',
              description: finding.to_s || finding.interesting_entries?.join('\n') || '',
              timestamp: new Date().toISOString()
            });
          });
        }
        if (data.vulns || (data.version && data.version.vulnerabilities)) {
          const vList = data.vulns || data.version.vulnerabilities;
          vList.forEach((v: { title?: string, id?: string, references?: { url?: string[] } }) => {
            findings.push({
              id: v.title || v.id || 'wpscan-vuln',
              name: v.title || 'WP Core Vulnerability',
              severity: 'high',
              scanner: 'wpscan',
              url: '',
              description: v.references?.url?.join('\n') || v.title || '',
              timestamp: new Date().toISOString()
            });
          });
        }
        if (data.plugins) {
          for (const [pluginName, pluginData] of Object.entries(data.plugins) as Iterable<[string, { vulnerabilities?: { id?: string, title?: string }[], location?: string }]>) {
            if (pluginData.vulnerabilities) {
              pluginData.vulnerabilities.forEach((v: { id?: string, title?: string }) => {
                findings.push({
                  id: v.id || `wpscan-plugin-${pluginName}`,
                  name: `Plugin Vuln: ${pluginName}`,
                  severity: 'medium',
                  scanner: 'wpscan',
                  url: pluginData.location || '',
                  description: v.title || '',
                  timestamp: new Date().toISOString()
                });
              });
            }
          }
        }
        if (data.themes) {
          for (const [themeName, themeData] of Object.entries(data.themes) as Iterable<[string, { vulnerabilities?: { id?: string, title?: string }[], location?: string }]>) {
            if (themeData.vulnerabilities) {
              themeData.vulnerabilities.forEach((v: { id?: string, title?: string }) => {
                findings.push({
                  id: v.id || `wpscan-theme-${themeName}`,
                  name: `Theme Vuln: ${themeName}`,
                  severity: 'medium',
                  scanner: 'wpscan',
                  url: themeData.location || '',
                  description: v.title || '',
                  timestamp: new Date().toISOString()
                });
              });
            }
          }
        }
        return findings;
      } catch (e) {
        logger.error('Failed to parse WPScan JSON:', e);
        return [];
      }
    }
  },
  katana: {
    getCommandArgs(ctx) { return ['-u', ctx.targetUrl, '-silent', '-j', '-o', ctx.jsonFile]; },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          findings.push({
            id: 'katana-endpoint',
            name: 'Endpoint Discovered',
            severity: 'info',
            scanner: 'katana',
            url: data.request?.endpoint || data.url || '',
            description: `Method: ${data.request?.method || 'GET'}`,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        } catch { /* ignore parse error */ }
      }
      return findings;
    }
  },
  ffuf: {
    getCommandArgs(ctx) {
      const wordlist = ctx.settings.wordlistPath ? path.resolve(process.cwd(), ctx.settings.wordlistPath as string) : 'C:\\wordlists\\common.txt';
      // If wordlist doesn't exist, we should ideally handle it, but for simplicity we assume it's checked earlier or returns error.
      return ['-u', `${ctx.targetUrl}/FUZZ`, '-w', wordlist, '-v', '-o', ctx.jsonFile, '-of', 'json'];
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const data = JSON.parse(content);
      const findings: Record<string, unknown>[] = [];
      if (data.results) {
        for (const res of data.results) {
          findings.push({
            id: 'ffuf-directory',
            name: 'Hidden Path Discovered',
            severity: 'info',
            scanner: 'ffuf',
            url: res.url || '',
            description: `Status: ${res.status}, Length: ${res.length}, Words: ${res.words}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
      return findings;
    }
  },
  appscan: {
    getCommandArgs(ctx) {
      return ['exec', '/su', ctx.targetUrl, '/dest', path.join(ctx.outDir, `appscan_${ctx.timestamp}.scan`), '/rf', ctx.xmlFile, '/rt', 'xml', '/v'];
    },
    parseFindings(ctx) {
      if (!ctx.xmlFile || !fs.existsSync(ctx.xmlFile)) return [];
      const content = fs.readFileSync(ctx.xmlFile, 'utf-8');
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const data = parser.parse(content);
      const findings: Record<string, unknown>[] = [];
      
      const issues = data?.XmlReport?.Issues?.Issue || data?.Issues?.Issue || [];
      const issuesArray = Array.isArray(issues) ? issues : [issues];
      
      for (const issue of issuesArray) {
        if (!issue) continue;
        findings.push({
          id: issue['@_IssueTypeID'] || 'appscan-finding',
          name: issue.IssueType?.name || issue['@_IssueType'] || 'AppScan Finding',
          severity: issue['@_Severity']?.toLowerCase() || 'medium',
          scanner: 'appscan',
          url: issue.Entity?.name || issue['@_Url'] || '',
          description: issue.Variant?.[0]?.Difference || issue.Difference || '',
          timestamp: new Date().toISOString(),
        });
      }
      return findings;
    }
  },
  netsparker: {
    getCommandArgs(ctx) {
      return ['/a', '/url', ctx.targetUrl, '/r', ctx.xmlFile, '/silent'];
    },
    getProcessOptions(ctx, opts) {
      const script = `Start-Process -Wait -NoNewWindow -FilePath '${ctx.bin}' -ArgumentList ${opts.args.map(a => `'${a.replace(/'/g, "''")}'`).join(', ')}`;
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
      const spawnArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript];
      return { executable: 'powershell.exe', args: spawnArgs, useShell: opts.useShell, cwd: opts.cwd };
    },
    parseFindings(ctx) {
      if (!ctx.xmlFile || !fs.existsSync(ctx.xmlFile)) return [];
      const content = fs.readFileSync(ctx.xmlFile, 'utf-8');
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const data = parser.parse(content);
      const findings: Record<string, unknown>[] = [];
      
      const vulns = data?.netsparker?.vulnerabilities?.vulnerability || data?.vulnerabilities?.vulnerability || [];
      const vulnsArray = Array.isArray(vulns) ? vulns : [vulns];
      
      for (const vuln of vulnsArray) {
        if (!vuln) continue;
        findings.push({
          id: vuln.type || 'netsparker-finding',
          name: vuln.name || 'Netsparker Finding',
          severity: vuln.severity?.toLowerCase() || 'medium',
          scanner: 'netsparker',
          url: vuln.url || '',
          description: vuln.description || '',
          timestamp: new Date().toISOString(),
        });
      }
      return findings;
    }
  },
  acunetix: {
    getCommandArgs(ctx) {
      const isPackaged = app.isPackaged;
      const runnerPath = isPackaged
        ? path.join(process.resourcesPath, 'scripts', 'acunetix_runner.js')
        : path.join(process.cwd(), 'electron', 'scripts', 'acunetix_runner.js');
      const acunetixUrl = ctx.settings.acunetixUrl || 'https://127.0.0.1:13443';
      const acunetixProfileId = ctx.settings.acunetixProfileId || '11111111-1111-1111-1111-111111111111';
      return [runnerPath, ctx.targetUrl, ctx.jsonFile, ctx.xmlFile, acunetixUrl, '', acunetixProfileId];
    },
    getEnv(ctx, env) {
      const e = { ...env, ELECTRON_RUN_AS_NODE: '1' };
      if (ctx.settings.acunetixApiKey) e.ACUNETIX_API_KEY = ctx.settings.acunetixApiKey;
      if (ctx.settings.acunetixEmail) e.ACUNETIX_EMAIL = ctx.settings.acunetixEmail;
      if (ctx.settings.acunetixPassword) e.ACUNETIX_PASSWORD = ctx.settings.acunetixPassword;
      return e;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const vulns = JSON.parse(content);
      const findings: Record<string, unknown>[] = [];
      for (const vuln of vulns) {
        if (!vuln) continue;
        let severity = 'info';
        if (vuln.severity === 3) severity = 'high';
        else if (vuln.severity === 2) severity = 'medium';
        else if (vuln.severity === 1) severity = 'low';

        findings.push({
          id: vuln.vt_id || vuln.vuln_id || 'acunetix-finding',
          name: vuln.vt_name || 'Acunetix Finding',
          severity: severity,
          scanner: 'acunetix',
          url: vuln.affects_url || vuln.affects_detail || '',
          description: vuln.tags ? vuln.tags.join(', ') : '',
          timestamp: new Date().toISOString(),
        });
      }
      return findings;
    }
  }
};

function genericJsonLinesParser(ctx: ScannerContext) {
  if (!fs.existsSync(ctx.jsonFile)) return [];
  const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
  const findings: Record<string, unknown>[] = [];
  const lines = content.split('\n').filter(l => l.trim() !== '');
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      findings.push({
        id: `${ctx.scannerName}-finding`,
        name: data.host || data.url || data.title || 'Discovered Item',
        severity: 'info',
        scanner: ctx.scannerName,
        url: data.url || data.host || '',
        description: JSON.stringify(data),
        timestamp: data.timestamp || new Date().toISOString(),
      });
    } catch { /* ignore parse error */ }
  }
  return findings;
}

export const getAdapter = (scannerName: string): IScannerAdapter => {
  return ScannerAdapters[scannerName] || {
    getCommandArgs: (ctx) => [ctx.targetUrl],
  };
};
