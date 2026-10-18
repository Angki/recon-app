import fs from 'fs';
import path from 'path';
import electron from 'electron';
import type { IScannerAdapter, ScannerContext } from './types';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '../logger';
import { activeAdapters } from './activeValidation';
import { storage } from '../storage';

export const ScannerAdapters: Record<string, IScannerAdapter> = {
  ...activeAdapters,
  nuclei: {
    getCommandArgs(ctx) {
      let targetArgs = ['-u', ctx.targetUrl];
      try {
        const scanDir = storage.getScanDir(ctx.scanId);
        const endpointsFile = path.join(scanDir, 'discovered_endpoints.txt');
        if (fs.existsSync(endpointsFile) && fs.statSync(endpointsFile).size > 0) {
          targetArgs = ['-l', endpointsFile];
        }
      } catch {
        // Fallback to single targetUrl
      }

      const args = [...targetArgs, '-severity', 'info,low,medium,high,critical', '-stats', '-duc', '-ni', '-o', ctx.outputFile, '-je', ctx.jsonFile];
      if (ctx.config?.isWordpress) {
        args.splice(2, 0, '-tags', 'wordpress,wp-plugin,wp-theme');
      }
      if ('nucleiTemplatesPath' in ctx.settings && ctx.settings.nucleiTemplatesPath) {
        args.push('-t', String(ctx.settings.nucleiTemplatesPath));
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
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
      if (!content) return [];
      const findings: Record<string, unknown>[] = [];

      const processItem = (data: Record<string, any>) => {
        if (!data || typeof data !== 'object') return;
        findings.push({
          id: data['template-id'] || 'nuclei-finding',
          name: data.info?.name || 'Unknown',
          severity: data.info?.severity || 'info',
          scanner: 'nuclei',
          url: data['matched-at'] || data.host || '',
          description: data.info?.description || '',
          timestamp: data.timestamp || new Date().toISOString(),
          extractedResults: Array.isArray(data['extracted-results']) ? data['extracted-results'] : (data['extracted-results'] ? [data['extracted-results']] : []),
          curlCommand: data['curl-command'] || '',
          references: Array.isArray(data.info?.reference) ? data.info.reference : (data.info?.reference ? [data.info.reference] : [])
        });
      };

      // 1. Try parsing whole content as a JSON array or object
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            processItem(item as Record<string, any>);
          }
          return findings;
        } else if (parsed && typeof parsed === 'object') {
          processItem(parsed as Record<string, any>);
          return findings;
        }
      } catch {
        // Fallback to line-by-line JSONL
      }

      // 2. Parse as JSON Lines (JSONL)
      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const item = JSON.parse(line.trim());
          if (Array.isArray(item)) {
            for (const sub of item) processItem(sub as Record<string, any>);
          } else {
            processItem(item as Record<string, any>);
          }
        } catch { /* ignore invalid line */ }
      }
      return findings;
    }
  },

  wapiti: {
    getCommandArgs(ctx) {
      return [
        '-u', ctx.targetUrl,
        '-d', '1',
        '--max-files-per-dir', '10',
        '--max-links-per-page', '20',
        '--scope', 'folder',
        '-l', '2',
        '-v', '2',
        '-f', 'json',
        '-dr', '2',
        '-o', ctx.jsonFile,
        '--flush-session',
        '--store-session', ctx.outDir,
        '--no-bugreport',
        '--max-attack-time', '180',
        '--timeout', '8',
        '--max-scan-time', '300'
      ];
    },
    isSuccessExitCode(code: number | null) {
      return code === 0 || code === 1 || code === 2;
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
      if (cleanMsg.includes('vulnerability found in') || cleanMsg.includes('Blind command execution')) {
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
      const findings: Record<string, unknown>[] = [];

      // 1. Primary: Parse JSON output file if generated
      if (fs.existsSync(ctx.jsonFile)) {
        try {
          const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
          const data = JSON.parse(content);
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
          if (findings.length > 0) return findings;
        } catch (e) {
          logger.warn(`Failed to parse Wapiti JSON file: ${e}`);
        }
      }

      // 2. Fallback: Parse stdout output if scanner timed out before generating final JSON report
      if (fs.existsSync(ctx.outputFile)) {
        try {
          const txt = fs.readFileSync(ctx.outputFile, 'utf-8');
          const rceMatches = txt.matchAll(/Blind command execution in (https?:\/\/[^\s]+) via injection in (the query string|the parameter [^\s]+)/g);
          const seen = new Set<string>();
          for (const match of rceMatches) {
            const endpoint = match[1];
            const injectionPoint = match[2];
            const key = `${endpoint}:${injectionPoint}`;
            if (!seen.has(key)) {
              seen.add(key);
              findings.push({
                id: 'wapiti-blind-command-execution',
                name: 'Command Execution (Blind / Time-based Heuristic)',
                severity: 'high',
                scanner: 'wapiti',
                url: endpoint,
                description: `Wapiti detected potential blind command injection via ${injectionPoint} based on response delay payloads. NOTE: Verify out-of-band to rule out high server latency / WAF rate-limiting false positive.`,
                remediation: 'Sanitize query parameters and avoid passing user input directly to system command execution functions.',
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (e) {
          logger.warn(`Failed to parse Wapiti text fallback output: ${e}`);
        }
      }

      return findings;
    }
  },

  subfinder: {
    getCommandArgs(ctx) {
      return ['-d', ctx.domain, '-silent', '-json', '-o', ctx.jsonFile];
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
            id: 'subfinder-domain',
            name: 'Subdomain Discovered',
            severity: 'info',
            scanner: 'subfinder',
            url: data.host || '',
            description: `Source: ${data.source || 'Unknown'}`,
            timestamp: new Date().toISOString(),
          });
        } catch { /* ignore */ }
      }
      return findings;
    }
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
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const ips = data.a ? data.a.join(', ') : 'Unknown IP';
          findings.push({
            id: 'dnsx-record',
            name: 'DNS Record Resolved',
            severity: 'info',
            scanner: 'dnsx',
            url: data.host || '',
            description: `Resolved IPs: ${ips}`,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        } catch { /* ignore */ }
      }
      return findings;
    }
  },
  naabu: {
    getCommandArgs(ctx) { return ['-host', ctx.domain, '-top-ports', '100', '-silent', '-json', '-o', ctx.jsonFile]; },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          findings.push({
            id: `naabu-port-${data.port}`,
            name: `Open Port Observation`,
            severity: 'info',
            scanner: 'naabu',
            url: `${data.host}:${data.port}`,
            description: `Port ${data.port} is open on ${data.host} (${data.ip || ''})`,
            timestamp: new Date().toISOString(),
          });
        } catch { /* ignore */ }
      }
      return findings;
    }
  },
  tlsx: {
    getCommandArgs(ctx) { return ['-u', ctx.domain, '-silent', '-json', '-o', ctx.jsonFile]; },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const issuer = data.issuer_dn || 'Unknown';
          const version = data.tls_version || 'Unknown TLS';
          findings.push({
            id: 'tlsx-info',
            name: 'TLS Certificate Info',
            severity: 'info',
            scanner: 'tlsx',
            url: data.host || '',
            description: `Version: ${version}, Issuer: ${issuer}`,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        } catch { /* ignore */ }
      }
      return findings;
    }
  },
  httpx: {
    getCommandArgs(ctx) { return ['-u', ctx.targetUrl, '-title', '-tech-detect', '-status-code', '-silent', '-json', '-o', ctx.jsonFile]; },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const tech = data.tech ? data.tech.join(', ') : 'None';
          findings.push({
            id: 'httpx-service',
            name: `HTTP Service: ${data.title || 'Untitled'}`,
            severity: 'info',
            scanner: 'httpx',
            url: data.url || data.host || '',
            description: `Status: ${data['status_code'] || 'Unknown'}\nTech: ${tech}\nWeb Server: ${data.webserver || 'Unknown'}`,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        } catch { /* ignore */ }
      }
      return findings;
    }
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
          name: 'Nmap Port Observation',
          severity: 'info',
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
      
      // Determine ephemeral proxy port to prevent collision with port 8080 (e.g. Burp Suite or other local proxies)
      const zapPort = ctx.config?.zapPort ? String(ctx.config.zapPort) : String(Math.floor(18000 + (Math.random() * 10000)));
      
      const baseArgs = [
        '-cmd',
        '-port', zapPort,
        '-config', `network.localServers.mainProxy.port=${zapPort}`,
        '-config', `proxy.port=${zapPort}`,
        '-config', 'spider.maxDepth=3',
        '-config', 'spider.maxChildren=20',
        '-dir', zapHome
      ];

      if (ctx.config?.zapAutomationPlan) {
        return [...baseArgs, '-autorun', String(ctx.config.zapAutomationPlan)];
      }
      if (ctx.config?.openapiUrl) {
        return [...baseArgs, '-openapifile', String(ctx.config.openapiUrl), '-quickurl', ctx.targetUrl, '-quickout', ctx.jsonFile];
      }
      return [...baseArgs, '-quickurl', ctx.targetUrl, '-quickout', ctx.jsonFile, '-quickprogress'];
    },
    getProcessOptions(ctx, opts) {
      // ZAP on Windows uses zap.bat which runs 'java -jar zap-X.XX.X.jar' relative to its own folder
      return {
        ...opts,
        cwd: path.dirname(ctx.bin)
      };
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      try {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
        if (!content) return [];
        const data = JSON.parse(content);
        const findings: Record<string, unknown>[] = [];
        
        // Handle both data.site array or single site object, plus fallback to top-level alerts
        const sites = Array.isArray(data?.site) ? data.site : (data?.site ? [data.site] : []);
        
        for (const site of sites) {
          const siteAlerts = Array.isArray(site?.alerts) ? site.alerts : (site?.alerts ? [site.alerts] : []);
          for (const alert of siteAlerts) {
            const rawRisk = alert.risk || (alert.riskdesc ? alert.riskdesc.split('(')[0].trim() : '');
            const risk = rawRisk.toLowerCase();
            const severity = risk.startsWith('high') ? 'high' : 
                             risk.startsWith('med') ? 'medium' :
                             risk.startsWith('low') ? 'low' : 'info';
            const firstInst = alert.instances?.[0];

            findings.push({
              id: alert.pluginid ? `zap-${alert.pluginid}` : 'zap-alert',
              name: alert.name || alert.alert || 'ZAP Finding',
              severity,
              scanner: 'zap',
              url: firstInst?.uri || site?.['@name'] || ctx.targetUrl,
              param: firstInst?.param || undefined,
              cwe: alert.cweid ? `CWE-${alert.cweid}` : undefined,
              description: alert.desc || alert.description || '',
              remediation: alert.solution || undefined,
              reference: alert.reference || undefined,
              confidence: (alert.confidence || 'Medium').toLowerCase(),
              timestamp: new Date().toISOString(),
              evidence: firstInst ? {
                method: firstInst.method,
                evidence: firstInst.evidence,
                attack: firstInst.attack
              } : undefined
            });
          }
        }

        // Top-level alerts fallback (if ZAP exported flat alerts structure)
        if (findings.length === 0 && Array.isArray(data?.alerts)) {
          for (const alert of data.alerts) {
            const rawRisk = alert.risk || (alert.riskdesc ? alert.riskdesc.split('(')[0].trim() : '');
            const risk = rawRisk.toLowerCase();
            const severity = risk.startsWith('high') ? 'high' : 
                             risk.startsWith('med') ? 'medium' :
                             risk.startsWith('low') ? 'low' : 'info';
            findings.push({
              id: alert.pluginid ? `zap-${alert.pluginid}` : 'zap-alert',
              name: alert.name || alert.alert || 'ZAP Finding',
              severity,
              scanner: 'zap',
              url: alert.instances?.[0]?.uri || ctx.targetUrl,
              cwe: alert.cweid ? `CWE-${alert.cweid}` : undefined,
              description: alert.desc || alert.description || '',
              remediation: alert.solution || undefined,
              confidence: (alert.confidence || 'Medium').toLowerCase(),
              timestamp: new Date().toISOString()
            });
          }
        }

        return findings;
      } catch (err) {
        logger.error(`Failed to parse ZAP output: ${err}`);
        return [];
      }
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
    isSuccessExitCode(code: number | null) {
      // 0: clean, 1: non-wordpress / redirect, 2: vulns found, 3: vulns with warnings, 4: aborted
      return code === 0 || code === 1 || code === 2 || code === 3 || code === 4;
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
          vList.forEach((v: { title?: string, id?: string, references?: { url?: string[], cve?: string[] } }) => {
            findings.push({
              id: v.title || v.id || 'wpscan-vuln',
              name: v.title || 'WP Core Vulnerability',
              severity: 'high',
              scanner: 'wpscan',
              url: '',
              description: v.title || '',
              references: v.references?.url || [],
              cves: v.references?.cve || [],
              timestamp: new Date().toISOString()
            });
          });
        }
        if (data.plugins) {
          for (const [pluginName, pluginData] of Object.entries(data.plugins) as Iterable<[string, { vulnerabilities?: { id?: string, title?: string, references?: { url?: string[], cve?: string[] } }[], location?: string }]>) {
            if (pluginData.vulnerabilities) {
              pluginData.vulnerabilities.forEach((v: { id?: string, title?: string, references?: { url?: string[], cve?: string[] } }) => {
                findings.push({
                  id: v.id || `wpscan-plugin-${pluginName}`,
                  name: `Plugin Vuln: ${pluginName}`,
                  severity: 'medium',
                  scanner: 'wpscan',
                  url: pluginData.location || '',
                  description: v.title || '',
                  references: v.references?.url || [],
                  cves: v.references?.cve || [],
                  timestamp: new Date().toISOString()
                });
              });
            }
          }
        }
        if (data.themes) {
          for (const [themeName, themeData] of Object.entries(data.themes) as Iterable<[string, { vulnerabilities?: { id?: string, title?: string, references?: { url?: string[], cve?: string[] } }[], location?: string }]>) {
            if (themeData.vulnerabilities) {
              themeData.vulnerabilities.forEach((v: { id?: string, title?: string, references?: { url?: string[], cve?: string[] } }) => {
                findings.push({
                  id: v.id || `wpscan-theme-${themeName}`,
                  name: `Theme Vuln: ${themeName}`,
                  severity: 'medium',
                  scanner: 'wpscan',
                  url: themeData.location || '',
                  description: v.title || '',
                  references: v.references?.url || [],
                  cves: v.references?.cve || [],
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
    getCommandArgs(ctx): string[] {
      const isPackaged = typeof electron === 'object' && electron !== null && 'app' in electron ? (electron as any).app.isPackaged : false;
      const runnerPath = isPackaged
        ? path.join(process.resourcesPath, 'scripts', 'acunetix_runner.js')
        : path.join(process.cwd(), 'electron', 'scripts', 'acunetix_runner.js');
      const acunetixUrl = String(('acunetixUrl' in ctx.settings ? ctx.settings.acunetixUrl : '') || 'https://127.0.0.1:13443');
      const acunetixProfileId = String(('acunetixProfileId' in ctx.settings ? ctx.settings.acunetixProfileId : '') || '11111111-1111-1111-1111-111111111111');
      return [runnerPath, ctx.targetUrl, ctx.jsonFile, ctx.xmlFile, acunetixUrl, '', acunetixProfileId];
    },
    getEnv(ctx, env) {
      const e: NodeJS.ProcessEnv = { ...env, ELECTRON_RUN_AS_NODE: '1' };
      const s = ctx.settings as Record<string, unknown>;
      if (s.acunetixApiKey) e.ACUNETIX_API_KEY = String(s.acunetixApiKey);
      if (s.acunetixEmail) e.ACUNETIX_EMAIL = String(s.acunetixEmail);
      if (s.acunetixPassword) e.ACUNETIX_PASSWORD = String(s.acunetixPassword);
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
  },

  dalfox: {
    getCommandArgs(ctx) {
      let targetArgs = ['url', ctx.targetUrl];
      try {
        const scanDir = storage.getScanDir(ctx.scanId);
        const endpointsFile = path.join(scanDir, 'discovered_endpoints.txt');
        if (fs.existsSync(endpointsFile) && fs.statSync(endpointsFile).size > 0) {
          targetArgs = ['file', endpointsFile];
        }
      } catch {
        // Fallback to url ctx.targetUrl
      }
      return [...targetArgs, '--format', 'json', '-o', ctx.jsonFile, '--no-color', '--timeout', '8', '-w', '5', '--skip-mining-dict'];
    },
    isSuccessExitCode(code: number | null) {
      return code === 0 || code === 1 || code === 2;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const items = Array.isArray(item) ? item : [item];
          for (const d of items) {
            findings.push({
              id: `dalfox-xss-${d.param || 'finding'}`,
              name: `XSS (${d.type || 'Reflected / DOM'})`,
              severity: (d.severity?.toLowerCase() || 'high'),
              scanner: 'dalfox',
              url: d.url || ctx.targetUrl,
              description: `Vulnerable param: ${d.param || 'unknown'} | Payload: ${d.payload || ''}`,
              timestamp: new Date().toISOString(),
              cwe: d.cwe || 'CWE-79',
              rawJson: JSON.stringify(d),
            });
          }
        } catch { /* ignore */ }
      }
      return findings;
    }
  },

  wafw00f: {
    getCommandArgs(ctx) {
      return [ctx.targetUrl, '-o', ctx.jsonFile, '-f', 'json'];
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      try {
        const data = JSON.parse(content);
        const list = Array.isArray(data) ? data : [data];
        for (const item of list) {
          if (item.detected || (item.firewall && item.firewall !== 'None')) {
            findings.push({
              id: 'wafw00f-detected',
              name: `WAF Detected: ${item.firewall || 'Active Firewall'}`,
              severity: 'info',
              scanner: 'wafw00f',
              url: item.url || ctx.targetUrl,
              description: `Target is protected by: ${item.firewall} (${item.manufacturer || 'Unknown Manufacturer'})`,
              timestamp: new Date().toISOString(),
              rawJson: JSON.stringify(item),
            });
          }
        }
      } catch { /* ignore */ }
      return findings;
    }
  },

  whatweb: {
    getCommandArgs(ctx) {
      return ['--color=never', `--log-json=${ctx.jsonFile}`, ctx.targetUrl];
    },
    isSuccessExitCode(code: number | null) {
      return code === 0;
    },
    parseFindings(ctx) {
      const fileToRead = fs.existsSync(ctx.jsonFile) ? ctx.jsonFile : fs.existsSync(ctx.outputFile) ? ctx.outputFile : null;
      if (!fileToRead) return [];
      const content = fs.readFileSync(fileToRead, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      try {
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          const data = JSON.parse(content);
          const list = Array.isArray(data) ? data : [data];
          for (const item of list) {
            const plugins = item.plugins ? Object.keys(item.plugins).join(', ') : 'None';
            findings.push({
              id: 'whatweb-tech',
              name: `Tech Fingerprint (HTTP ${item.http_status || 200})`,
              severity: 'info',
              scanner: 'whatweb',
              url: item.target || ctx.targetUrl,
              description: `Detected technologies: ${plugins}`,
              timestamp: new Date().toISOString(),
              rawJson: JSON.stringify(item),
            });
          }
          return findings;
        }
      } catch { /* fallback to text parsing */ }

      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        if (line.includes('[') && line.includes(']')) {
          findings.push({
            id: 'whatweb-tech',
            name: 'Web Technology Fingerprint',
            severity: 'info',
            scanner: 'whatweb',
            url: ctx.targetUrl,
            description: line.trim(),
            timestamp: new Date().toISOString(),
            rawJson: JSON.stringify({ stdout: line.trim() }),
          });
        }
      }
      return findings;
    }
  },

  arjun: {
    getCommandArgs(ctx) {
      return ['-u', ctx.targetUrl, '-oJ', ctx.jsonFile, '--stable', '-t', '5'];
    },
    isSuccessExitCode(code: number | null) {
      return code === 0 || code === 1;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      try {
        let data: unknown;
        try {
          data = JSON.parse(content);
        } catch {
          const start = content.indexOf('{');
          const end = content.lastIndexOf('}');
          if (start !== -1 && end > start) {
            data = JSON.parse(content.slice(start, end + 1));
          }
        }
        if (data && typeof data === 'object') {
          for (const [url, params] of Object.entries(data as Record<string, unknown>)) {
            const paramList = Array.isArray(params) ? params : [];
            if (paramList.length > 0) {
              findings.push({
                id: 'arjun-hidden-params',
                name: `Hidden Parameters Discovered (${paramList.length})`,
                severity: 'info',
                scanner: 'arjun',
                url,
                description: `Discovered parameters: ${paramList.join(', ')}`,
                timestamp: new Date().toISOString(),
                rawJson: JSON.stringify({ url, params }),
              });
            }
          }
        }
      } catch { /* ignore */ }
      return findings;
    }
  },

  corsy: {
    getCommandArgs(ctx) {
      return ['-u', ctx.targetUrl, '-o', ctx.jsonFile];
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];
      try {
        const data = JSON.parse(content);
        for (const [url, issues] of Object.entries(data)) {
          const issueList = Array.isArray(issues) ? issues : [issues];
          for (const iss of issueList as Array<{ class?: string; severity?: string; description?: string }>) {
            findings.push({
              id: 'corsy-misconfig',
              name: `CORS Misconfiguration: ${iss.class || 'Insecure Origin'}`,
              severity: (iss.severity?.toLowerCase() || 'medium'),
              scanner: 'corsy',
              url,
              description: iss.description || 'Insecure CORS policy configuration detected.',
              timestamp: new Date().toISOString(),
              rawJson: JSON.stringify(iss),
            });
          }
        }
      } catch { /* ignore */ }
      return findings;
    }
  },

  cmseek: {
    getCommandArgs(ctx) {
      return ['-u', ctx.targetUrl, '--batch', '-r'];
    },
    parseFindings(ctx) {
      const possibleJson = path.join(ctx.outDir, 'cms.json');
      const cwdJson = path.join(process.cwd(), 'Result', ctx.domain, 'cms.json');
      const appDataJson = process.env.APPDATA ? path.join(process.env.APPDATA, 'ReconApp', 'tools', 'CMSeeK', 'Result', ctx.domain, 'cms.json') : null;
      const targetFile = fs.existsSync(possibleJson) ? possibleJson : (appDataJson && fs.existsSync(appDataJson)) ? appDataJson : fs.existsSync(cwdJson) ? cwdJson : null;
      if (!targetFile) return [];
      try {
        const content = fs.readFileSync(targetFile, 'utf-8');
        const data = JSON.parse(content);
        return [{
          id: 'cmseek-cms',
          name: `CMS Detected: ${data.cms_name || 'Web CMS'}`,
          severity: data.vulnerabilities && data.vulnerabilities.length > 0 ? 'high' : 'info',
          scanner: 'cmseek',
          url: data.url || ctx.targetUrl,
          description: `CMS: ${data.cms_name || 'Unknown'} (v${data.cms_version || 'unknown'}). ${data.vulnerabilities ? `Vulns: ${JSON.stringify(data.vulnerabilities)}` : ''}`,
          timestamp: new Date().toISOString(),
          rawJson: content,
        }];
      } catch { return []; }
    }
  },

  gau: {
    getCommandArgs(ctx) {
      return [ctx.domain, '--json', '--o', ctx.jsonFile];
    },
    parseFindings(ctx) {
      const fileToRead = fs.existsSync(ctx.jsonFile) ? ctx.jsonFile : fs.existsSync(ctx.outputFile) ? ctx.outputFile : null;
      if (!fileToRead) return [];
      const content = fs.readFileSync(fileToRead, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim() !== '');
      if (lines.length > 0) {
        return [{
          id: 'gau-urls',
          name: `Historical URLs & Endpoints (${lines.length})`,
          severity: 'info',
          scanner: 'gau',
          url: ctx.domain,
          description: `Discovered ${lines.length} historical URLs across Wayback, AlienVault OTX, and Common Crawl.`,
          timestamp: new Date().toISOString(),
          rawJson: JSON.stringify({ count: lines.length, sample: lines.slice(0, 20) }),
        }];
      }
      return [];
    }
  },

  crlfsuite: {
    getCommandArgs(ctx) {
      return ['-t', ctx.targetUrl, '-oJ', ctx.jsonFile, '-sL'];
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      try {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
        if (!content || content === '{}' || content === '[]') return [];
        const data = JSON.parse(content);
        const findings: Record<string, unknown>[] = [];
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          if (!item.payload && !item.parameter && !item.vuln) continue;
          findings.push({
            id: 'crlf-injection',
            name: 'CRLF Injection / HTTP Response Splitting',
            severity: 'medium',
            scanner: 'crlfsuite',
            url: item.url || ctx.targetUrl,
            description: `Payload: ${item.payload || item.parameter || 'Header injection confirmed'}`,
            timestamp: new Date().toISOString(),
            rawJson: JSON.stringify(item),
          });
        }
        return findings;
      } catch { return []; }
    }
  },

  sslyze: {
    getCommandArgs(ctx) {
      return ['--json_out', ctx.jsonFile, '--slow_connection', ctx.domain];
    },
    isSuccessExitCode(code: number | null) {
      // SSLyze exits with 1 or 2 on minor warnings or partial module timeouts, while JSON is intact
      return code === 0 || code === 1 || code === 2;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      try {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
        if (!content) return [];
        const data = JSON.parse(content);
        const findings: Record<string, unknown>[] = [];
        const results = data.server_scan_results || [];

        for (const targetResult of results) {
          const host = targetResult.server_location?.hostname || ctx.domain;
          const scanCommands = targetResult.scan_commands_results || {};

          // Certificate Validation
          const certInfo = scanCommands.certificate_info;
          if (certInfo && certInfo.certificate_deployments) {
            for (const deployment of certInfo.certificate_deployments) {
              const chainValidation = deployment.path_validation_results?.[0];
              if (chainValidation && chainValidation.was_validation_successful === false) {
                findings.push({
                  id: 'sslyze-invalid-certificate',
                  name: 'Untrusted or Invalid SSL/TLS Certificate',
                  severity: 'high',
                  scanner: 'sslyze',
                  url: `https://${host}`,
                  description: chainValidation.openssl_error_string || 'Certificate path validation failed: untrusted root or verification error.',
                  timestamp: new Date().toISOString()
                });
              }

              const leaf = deployment.received_certificate_chain?.[0];
              if (leaf?.not_valid_after) {
                const expiry = new Date(leaf.not_valid_after);
                if (expiry < new Date()) {
                  findings.push({
                    id: 'sslyze-expired-certificate',
                    name: 'Expired SSL/TLS Certificate',
                    severity: 'high',
                    scanner: 'sslyze',
                    url: `https://${host}`,
                    description: `Certificate expired on ${expiry.toISOString()}.`,
                    timestamp: new Date().toISOString()
                  });
                }
              }
            }
          }

          // Insecure Protocols (SSL 2.0 / SSL 3.0 / TLS 1.0 / TLS 1.1)
          const checkProtocol = (cmdKey: string, protocolName: string, sev: string) => {
            const protoResult = scanCommands[cmdKey];
            if (protoResult && protoResult.ciphers_supported && protoResult.ciphers_supported.length > 0) {
              findings.push({
                id: `sslyze-${protocolName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-enabled`,
                name: `Deprecated Protocol Enabled: ${protocolName}`,
                severity: sev,
                scanner: 'sslyze',
                url: `https://${host}`,
                description: `${protocolName} is deprecated, insecure, and should be disabled in server configuration. Accepted ciphers: ${protoResult.ciphers_supported.length}`,
                remediation: `Disable ${protocolName} in web server TLS settings and enforce TLS 1.2 and TLS 1.3 only.`,
                timestamp: new Date().toISOString()
              });
            }
          };

          checkProtocol('ssl_2_0_cipher_suites', 'SSL 2.0', 'high');
          checkProtocol('ssl_3_0_cipher_suites', 'SSL 3.0', 'high');
          checkProtocol('tls_1_0_cipher_suites', 'TLS 1.0', 'medium');
          checkProtocol('tls_1_1_cipher_suites', 'TLS 1.1', 'medium');

          // Vulnerability checks
          if (scanCommands.heartbleed?.is_vulnerable_to_heartbleed) {
            findings.push({
              id: 'sslyze-heartbleed-vulnerable',
              name: 'Vulnerable to OpenSSL Heartbleed (CVE-2014-0160)',
              severity: 'critical',
              scanner: 'sslyze',
              url: `https://${host}`,
              description: 'Target server is vulnerable to Heartbleed memory leakage vulnerability.',
              remediation: 'Upgrade OpenSSL immediately and regenerate private keys/certificates.',
              timestamp: new Date().toISOString()
            });
          }

          if (scanCommands.robot?.robot_result && scanCommands.robot.robot_result !== 'NOT_VULNERABLE') {
            findings.push({
              id: 'sslyze-robot-vulnerable',
              name: 'Vulnerable to Return of Bleichenbacher Attack (ROBOT)',
              severity: 'high',
              scanner: 'sslyze',
              url: `https://${host}`,
              description: `Target server is vulnerable to ROBOT attack: ${scanCommands.robot.robot_result}.`,
              remediation: 'Disable RSA encryption cipher suites and utilize ECDHE key exchange.',
              timestamp: new Date().toISOString()
            });
          }
        }
        return findings;
      } catch (err) {
        logger.error(`Failed to parse SSLyze output: ${err}`);
        throw new Error(`Failed to parse SSLyze output: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      }
    }
  },

  gitleaks: {
    getCommandArgs(ctx) {
      const isDir = fs.existsSync(ctx.targetUrl);
      const mode = isDir ? 'dir' : 'git';
      return [mode, ctx.targetUrl, '--report-format', 'json', '--report-path', ctx.jsonFile, '--redact', '--exit-code', '0'];
    },
    isSuccessExitCode(code: number | null) {
      return code === 0 || code === 1;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      try {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
        if (!content) return [];
        const raw = JSON.parse(content);
        const leaks = Array.isArray(raw) ? raw : [];
        const findings: Record<string, unknown>[] = [];

        for (const leak of leaks) {
          const ruleId = leak.RuleID || 'gitleaks-secret';
          const file = leak.File || 'unknown';
          const line = leak.StartLine || 1;
          const isKeyOrCloud = /private|rsa|aws|azure|gcp|slack|token|password|credential/i.test(ruleId);
          
          findings.push({
            id: `gitleaks-${ruleId}`,
            name: `Exposed Secret: ${leak.Description || ruleId}`,
            severity: isKeyOrCloud ? 'critical' : 'high',
            scanner: 'gitleaks',
            url: file.startsWith('http') ? file : `file://${file}#L${line}`,
            param: ruleId,
            description: `Secret detected by rule '${ruleId}' in ${file}:${line}. The secret value has been redacted for confidentiality. Commit: ${leak.Commit || 'N/A'}.`,
            remediation: 'Revoke and rotate the exposed credential immediately. Remove from Git history or configure .gitleaksignore if confirmed test fixture.',
            evidence: {
              ruleId,
              file,
              line,
              commit: leak.Commit || undefined,
              author: leak.Author || undefined,
              date: leak.Date || undefined
            },
            timestamp: leak.Date || new Date().toISOString()
          });
        }
        return findings;
      } catch (err) {
        logger.error(`Failed to parse Gitleaks output: ${err}`);
        throw new Error(`Failed to parse Gitleaks output: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      }
    }
  },

  semgrep: {
    getCommandArgs(ctx) {
      const isRemoteUrl = ctx.targetUrl.startsWith('http://') || ctx.targetUrl.startsWith('https://');
      if (isRemoteUrl) {
        throw new Error('Semgrep requires a local source directory and cannot scan remote web URLs or fallback to the scan output directory.');
      }
      return ['scan', '--config', 'auto', '--json', '--output', ctx.jsonFile, '--disable-version-check', ctx.targetUrl];
    },
    isSuccessExitCode(code: number | null) {
      return code === 0 || code === 1 || code === 2;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      try {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
        if (!content) return [];
        const data = JSON.parse(content);
        const results = Array.isArray(data.results) ? data.results : [];
        const findings: Record<string, unknown>[] = [];

        for (const item of results) {
          const rawSev = (item.extra?.severity || 'INFO').toUpperCase();
          const severity = rawSev === 'ERROR' ? 'high' : rawSev === 'WARNING' ? 'medium' : 'low';
          const checkId = item.check_id || 'semgrep-rule';
          const shortName = checkId.split('.').pop() || checkId;
          const filePath = item.path || 'unknown';
          const line = item.start?.line || 1;
          const cweList = item.extra?.metadata?.cwe;
          const cwe = Array.isArray(cweList) ? cweList[0] : (typeof cweList === 'string' ? cweList : undefined);

          findings.push({
            id: `semgrep-${checkId}`,
            name: `SAST: ${shortName.replace(/[-_]/g, ' ')}`,
            severity,
            scanner: 'semgrep',
            url: `file://${filePath}#L${line}`,
            cwe,
            description: item.extra?.message || `Semgrep finding for rule ${checkId}`,
            remediation: item.extra?.metadata?.remediation || undefined,
            evidence: {
              checkId,
              path: filePath,
              start: item.start,
              end: item.end,
              lines: item.extra?.lines
            },
            timestamp: new Date().toISOString()
          });
        }

        if (findings.length === 0 && (ctx.targetUrl.startsWith('http://') || ctx.targetUrl.startsWith('https://'))) {
          findings.push({
            id: 'semgrep-sast-notice',
            name: 'SAST Engine Notice: Local Source Code Only',
            severity: 'info',
            scanner: 'semgrep',
            url: ctx.targetUrl,
            description: 'Semgrep is an offline Static Application Security Testing (SAST) engine designed for local source repositories. For remote web application scanning, DAST engines (Nuclei, Wapiti, ZAP, Dalfox) are active.',
            timestamp: new Date().toISOString()
          });
        }

        return findings;
      } catch (err) {
        logger.error(`Failed to parse Semgrep output: ${err}`);
        throw new Error(`Failed to parse Semgrep output: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      }
    }
  },

  trivy: {
    getCommandArgs(ctx) {
      return ['fs', '--format', 'json', '--output', ctx.jsonFile, '--scanners', 'vuln,misconfig', ctx.targetUrl];
    },
    isSuccessExitCode(code: number | null) {
      return code === 0 || code === 1;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      try {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
        if (!content) return [];
        const data = JSON.parse(content);
        const results = Array.isArray(data.Results) ? data.Results : [];
        const findings: Record<string, unknown>[] = [];

        for (const res of results) {
          const target = res.Target || 'Target Package';

          if (Array.isArray(res.Vulnerabilities)) {
            for (const v of res.Vulnerabilities) {
              const rawSev = (v.Severity || 'UNKNOWN').toLowerCase();
              const severity = rawSev === 'critical' ? 'critical' :
                                rawSev === 'high' ? 'high' :
                                rawSev === 'medium' ? 'medium' :
                                rawSev === 'low' ? 'low' : 'info';

              findings.push({
                id: v.VulnerabilityID || 'trivy-vuln',
                name: `Dependency Vulnerability: ${v.PkgName} (${v.VulnerabilityID})`,
                severity,
                scanner: 'trivy',
                url: v.PrimaryURL || `package://${v.PkgName}@${v.InstalledVersion || 'unknown'}`,
                cve: v.VulnerabilityID?.startsWith('CVE') ? v.VulnerabilityID : undefined,
                cwe: v.CweIDs?.[0],
                description: `${v.Title ? v.Title + ' - ' : ''}${v.Description || 'Known vulnerability in installed package.'} Installed: ${v.InstalledVersion}, Fixed in: ${v.FixedVersion || 'None'}.`,
                remediation: v.FixedVersion ? `Upgrade ${v.PkgName} to version ${v.FixedVersion} or later.` : 'No fix version currently available. Monitor upstream updates.',
                timestamp: new Date().toISOString()
              });
            }
          }

          if (Array.isArray(res.Misconfigurations)) {
            for (const m of res.Misconfigurations) {
              const rawSev = (m.Severity || 'UNKNOWN').toLowerCase();
              const severity = rawSev === 'critical' ? 'critical' :
                                rawSev === 'high' ? 'high' :
                                rawSev === 'medium' ? 'medium' :
                                rawSev === 'low' ? 'low' : 'info';

              findings.push({
                id: m.ID || 'trivy-misconfig',
                name: `Misconfiguration: ${m.Title || m.ID}`,
                severity,
                scanner: 'trivy',
                url: `file://${target}#L${m.IOMisconfig?.StartLine || 1}`,
                description: m.Description || m.Message || 'Infrastructure or config file misconfiguration detected.',
                remediation: m.Resolution || undefined,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        return findings;
      } catch (err) {
        logger.error(`Failed to parse Trivy output: ${err}`);
        throw new Error(`Failed to parse Trivy output: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      }
    }
  },

  schemathesis: {
    getCommandArgs(ctx) {
      const schema = ctx.config?.schemathesisSchema ? String(ctx.config.schemathesisSchema) : ctx.targetUrl;
      const args = [
        'run',
        schema,
        '--url', ctx.targetUrl,
        '--checks', 'all',
        '--rate-limit', '10/s',
        '--report', 'json',
        '--report-json-path', ctx.jsonFile,
        '--no-color'
      ];
      if (ctx.config?.schemathesisSafeOnly) {
        args.push('--include-method', 'GET,HEAD,OPTIONS');
      }
      return args;
    },
    isSuccessExitCode(code: number | null) {
      return code === 0 || code === 1;
    },
    getEnv(ctx, env) {
      return {
        ...env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      };
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      try {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
        if (!content) return [];
        const data = JSON.parse(content);
        const findings: Record<string, unknown>[] = [];

        const events = Array.isArray(data.events) ? data.events : [];
        for (const evt of events) {
          if (evt.status === 'failure' || evt.status === 'error') {
            const is5xx = Array.isArray(evt.checks) && evt.checks.some((c: any) => c.name === 'not_a_server_error' && c.status === 'failure');
            const severity = is5xx ? 'high' : 'low';
            const issueType = is5xx ? 'Unhandled Server Error (5xx Crash)' : 'API Quality: Schema Conformity Failure';

            findings.push({
              id: `schemathesis-${evt.method || 'REQ'}-${evt.path || 'endpoint'}`,
              name: `${issueType}: ${evt.method || 'GET'} ${evt.path || ctx.targetUrl}`,
              severity,
              scanner: 'schemathesis',
              url: `${ctx.targetUrl}${evt.path || ''}`,
              description: evt.message || `Schemathesis reported ${issueType} during property-based test.`,
              remediation: is5xx
                ? 'Investigate server exception logs and prevent unhandled 500 error responses.'
                : 'Update API schema specification or adjust response payload format to match schema.',
              timestamp: new Date().toISOString()
            });
          }
        }

        if (findings.length === 0 && Array.isArray(data.tasks)) {
          for (const task of data.tasks) {
            if (Array.isArray(task.checks)) {
              for (const chk of task.checks) {
                if (chk.status === 'failure') {
                  const is5xx = chk.name === 'not_a_server_error';
                  findings.push({
                    id: `schemathesis-${task.method || 'API'}-${chk.name}`,
                    name: is5xx ? `Server Error: ${task.method} ${task.path}` : `API Quality Issue: ${chk.name}`,
                    severity: is5xx ? 'high' : 'low',
                    scanner: 'schemathesis',
                    url: `${ctx.targetUrl}${task.path || ''}`,
                    description: chk.message || `Check ${chk.name} failed during contract fuzzing.`,
                    remediation: is5xx ? 'Handle input gracefully without crashing.' : 'Align response format with schema.',
                    timestamp: new Date().toISOString()
                  });
                }
              }
            }
          }
        }

        return findings;
      } catch (err) {
        logger.error(`Failed to parse Schemathesis output: ${err}`);
        throw new Error(`Failed to parse Schemathesis output: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      }
    }
  },

  syft: {
    getCommandArgs(ctx) {
      const isPath = fs.existsSync(ctx.targetUrl) || ctx.targetUrl.startsWith('/') || /^[a-zA-Z]:\\/.test(ctx.targetUrl) || ctx.targetUrl.startsWith('.');
      const targetArg = isPath ? `dir:${ctx.targetUrl}` : ctx.targetUrl;
      return [targetArg, '-o', `json=${ctx.jsonFile}`, '-q'];
    },
    isSuccessExitCode(code) {
      return code === 0;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      return parseSyft(content, ctx);
    }
  },

  interactsh: {
    getCommandArgs(ctx) {
      const args = ['-json', '-o', ctx.jsonFile, '-v'];
      const server = (ctx.settings as any)?.interactshServer || (ctx.config?.interactshServer as string);
      if (server) {
        args.push('-server', server);
      }
      const token = (ctx.settings as any)?.interactshToken || (ctx.config?.interactshToken as string);
      if (token) {
        args.push('-token', token);
      }
      const correlationId = (ctx.config?.correlationId as string) || ctx.scanId;
      if (correlationId) {
        args.push('-cid', correlationId);
      }
      return args;
    },
    isSuccessExitCode(code) {
      return code === 0;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      return parseInteractsh(content, ctx);
    }
  }
};

export function parseSyft(content: string, ctx: Pick<ScannerContext, 'targetUrl'>) {
  if (!content.trim()) return [];
  let data: any;
  try {
    data = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse Syft JSON: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.artifacts)) {
    throw new Error('Malformed Syft JSON output: missing artifacts array');
  }

  const findings: Record<string, unknown>[] = [];
  for (const pkg of data.artifacts) {
    if (!pkg || typeof pkg.name !== 'string') continue;
    const version = pkg.version || 'unknown';
    const purl = pkg.purl || 'N/A';
    const licenses = Array.isArray(pkg.licenses) ? pkg.licenses : (pkg.license ? [pkg.license] : []);
    const licenseNames = licenses.map((l: any) => typeof l === 'string' ? l : (l.value || l.spdxExpression || JSON.stringify(l))).filter(Boolean);

    findings.push({
      id: `syft-pkg-${pkg.name}-${version}`,
      name: `Software Component: ${pkg.name} (${version})`,
      severity: 'info',
      scanner: 'syft',
      url: ctx.targetUrl,
      cwe: 'CWE-1395',
      confidence: 'tool-confirmed',
      description: `Syft cataloged ${pkg.type || 'unknown'} package ${pkg.name}@${version}. PURL: ${purl}. Licenses: ${licenseNames.join(', ') || 'Unknown'}.`,
      remediation: 'Maintain component in Software Bill of Materials (SBOM) and audit for known upstream CVE vulnerabilities.',
      evidence: {
        name: pkg.name,
        version,
        type: pkg.type || 'unknown',
        purl,
        licenses: licenseNames,
        locations: pkg.locations || [],
        source: data.source?.target || ctx.targetUrl
      },
      timestamp: new Date().toISOString()
    });
  }

  return findings;
}

export function parseInteractsh(content: string, ctx: Pick<ScannerContext, 'targetUrl'>) {
  if (!content.trim()) return [];
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  const findings: Record<string, unknown>[] = [];

  for (const line of lines) {
    let item: any;
    try {
      item = JSON.parse(line);
    } catch (err) {
      throw new Error(`Malformed Interactsh JSON line: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }

    if (!item || typeof item !== 'object') continue;
    const protocol = String(item.protocol || 'OOB').toUpperCase();
    const uniqueId = item['unique-id'] || 'session';
    const fullId = item['full-id'] || uniqueId;
    
    // Strict IP and credential redaction
    const rawReq = item['raw-request'] ? String(item['raw-request'])
      .replace(/Authorization:\s*.+/gi, 'Authorization: [REDACTED]')
      .replace(/Cookie:\s*.+/gi, 'Cookie: [REDACTED]') : undefined;

    findings.push({
      id: `interactsh-${uniqueId}-${protocol.toLowerCase()}`,
      name: `Out-of-Band (OOB) Interaction: ${protocol}`,
      severity: 'high',
      scanner: 'interactsh',
      url: ctx.targetUrl,
      confidence: 'tool-confirmed',
      cwe: 'CWE-918',
      description: `Interactsh received an out-of-band ${protocol} callback for correlation session ${uniqueId}. Proves external network interaction initiated by target.`,
      remediation: 'Restrict outbound network egress from backend servers and validate URL input schemas strictly.',
      evidence: {
        protocol,
        uniqueId,
        fullId,
        remoteAddress: '[REDACTED_IP]',
        timestamp: item.timestamp || new Date().toISOString(),
        rawRequestSnippet: rawReq ? rawReq.slice(0, 500) : undefined
      },
      timestamp: new Date().toISOString()
    });
  }

  return findings;
}

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
