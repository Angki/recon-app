import fs from 'fs';
import path from 'path';
import electron from 'electron';
import type { IScannerAdapter, ScannerContext } from './types';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '../logger';
import { activeAdapters } from './activeValidation';
import { storage } from '../storage';
import { resolveWordlist } from '../wordlists';
import { discoveredHostsFile } from '../hostInventory';

function authHeaderArgs(ctx: ScannerContext): string[] {
  const headers = ctx.authHeaders || {};
  return Object.entries(headers).flatMap(([name, value]) => ['-H', `${name}: ${value}`]);
}

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
      args.push(...authHeaderArgs(ctx));
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
      const findings: Record<string, unknown>[] = [];

      interface NucleiRawItem {
        'template-id'?: string;
        info?: {
          name?: string;
          severity?: string;
          description?: string;
          reference?: string[] | string;
        };
        'matched-at'?: string;
        host?: string;
        timestamp?: string;
        'extracted-results'?: string[] | string;
        'curl-command'?: string;
      }

      const processItem = (data: NucleiRawItem) => {
        if (!data || typeof data !== 'object') return;
        const info = data.info;
        findings.push({
          id: data['template-id'] || 'nuclei-finding',
          name: info?.name || 'Unknown',
          severity: info?.severity || 'info',
          scanner: 'nuclei',
          url: data['matched-at'] || data.host || '',
          description: info?.description || '',
          timestamp: data.timestamp || new Date().toISOString(),
          extractedResults: Array.isArray(data['extracted-results']) ? data['extracted-results'] : (data['extracted-results'] ? [data['extracted-results']] : []),
          curlCommand: data['curl-command'] || '',
          references: Array.isArray(info?.reference) ? info.reference : (info?.reference ? [info.reference] : [])
        });
      };

      // 1. Try parsing JSON/JSONL output file
      if (fs.existsSync(ctx.jsonFile)) {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
        if (content) {
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                processItem(item as NucleiRawItem);
              }
            } else if (parsed && typeof parsed === 'object') {
              processItem(parsed as NucleiRawItem);
            }
          } catch {
            // Fallback to line-by-line JSONL
            const lines = content.split('\n').filter(l => l.trim() !== '');
            for (const line of lines) {
              try {
                const item = JSON.parse(line.trim());
                if (Array.isArray(item)) {
                  for (const sub of item) processItem(sub as NucleiRawItem);
                } else {
                  processItem(item as NucleiRawItem);
                }
              } catch { /* ignore invalid line */ }
            }
          }
        }
      }

      // 2. Fallback: Parse stdout text output file if jsonFile was missing or empty
      if (findings.length === 0 && fs.existsSync(ctx.outputFile)) {
        try {
          const txtContent = fs.readFileSync(ctx.outputFile, 'utf-8');
          // eslint-disable-next-line no-control-regex
          const cleanTxt = txtContent.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
          const lines = cleanTxt.split('\n');
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('[INF]') || line.startsWith('[WRN]') || line.startsWith('[DBG]')) continue;
            // Format: [template-id] [protocol] [severity] url/host [extracted-results]
            const match = line.match(/^\[([a-zA-Z0-9_-]+)\](?:\s*\[[^\]]+\])*\s*\[(info|low|medium|high|critical)\]\s*(\S+)(?:\s*(.*))?$/i);
            if (match) {
              const templateId = match[1];
              const severity = match[2].toLowerCase();
              const matchedUrl = match[3];
              const extra = match[4]?.trim() || '';
              findings.push({
                id: templateId,
                name: `Nuclei Detection: ${templateId}`,
                severity,
                scanner: 'nuclei',
                url: matchedUrl,
                description: `Nuclei matched template ${templateId} on ${matchedUrl}.${extra ? ' Extracted: ' + extra : ''}`,
                timestamp: new Date().toISOString(),
                extractedResults: extra ? [extra] : [],
                references: []
              });
            }
          }
        } catch { /* ignore */ }
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
        '--max-scan-time', '300',
        ...authHeaderArgs(ctx)
      ];
    },
    isSuccessExitCode(code: number | null, ctx?: ScannerContext) {
      if (code === 0 || code === 2) return true;
      if (code === 1 && ctx) {
        return fs.existsSync(ctx.jsonFile) && fs.statSync(ctx.jsonFile).size > 0;
      }
      return false;
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
          const classifications: Record<string, { desc?: string; sol?: string; wstg?: string[] | string }> = data.classifications || {};

          if (data.vulnerabilities) {
            for (const [vulnType, vulns] of Object.entries(data.vulnerabilities)) {
              const vulnArray = vulns as Array<{
                level?: number;
                path?: string;
                info?: string;
                http_request?: string;
                curl_command?: string;
                parameter?: string;
                wstg?: string[];
              }>;
              const defaultRemediation = classifications[vulnType]?.sol;
              const classificationDesc = classifications[vulnType]?.desc;

              for (const v of vulnArray) {
                let resolvedUrl = v.path || '';
                if (resolvedUrl && !resolvedUrl.startsWith('http')) {
                  try {
                    resolvedUrl = new URL(resolvedUrl, ctx.targetUrl).toString();
                  } catch {
                    resolvedUrl = ctx.targetUrl;
                  }
                } else if (!resolvedUrl) {
                  resolvedUrl = ctx.targetUrl;
                }

                const classWstg = classifications[vulnType]?.wstg;
                const wstgVal = (Array.isArray(v.wstg) && v.wstg.length > 0)
                  ? v.wstg[0]
                  : (Array.isArray(classWstg) && classWstg.length > 0)
                  ? classWstg[0]
                  : (typeof classWstg === 'string' ? classWstg : undefined);

                findings.push({
                  id: `wapiti-${vulnType.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                  name: vulnType,
                  severity: v.level === 1 ? 'low' : v.level === 2 ? 'medium' : 'high',
                  scanner: 'wapiti',
                  url: resolvedUrl,
                  description: v.info || classificationDesc || `${vulnType} vulnerability reported by Wapiti.`,
                  remediation: defaultRemediation || 'Review web application security configurations and sanitize user inputs.',
                  timestamp: new Date().toISOString(),
                  httpRequest: v.http_request || '',
                  curlCommand: v.curl_command || '',
                  parameter: v.parameter || '',
                  wstg: wstgVal
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
    handleStdin(ctx, proc) {
      const hostsFile = discoveredHostsFile(ctx);
      if (hostsFile) {
        try {
          proc.stdin?.write(fs.readFileSync(hostsFile, 'utf8'));
          return;
        } catch {
          // Fall back to the root domain below.
        }
      }
      proc.stdin?.write(ctx.domain + '\n');
    },
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
    getCommandArgs(ctx) {
      const hostsFile = discoveredHostsFile(ctx);
      return hostsFile
        ? ['-l', hostsFile, '-silent', '-json', '-o', ctx.jsonFile]
        : ['-silent', '-json', '-o', ctx.jsonFile];
    },
    handleStdin(ctx, proc) {
      if (discoveredHostsFile(ctx)) return;
      proc.stdin?.write(ctx.domain + '\n');
    },
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
    getCommandArgs(ctx) {
      const hostsFile = discoveredHostsFile(ctx);
      return hostsFile
        ? ['-list', hostsFile, '-top-ports', '100', '-silent', '-json', '-o', ctx.jsonFile]
        : ['-host', ctx.domain, '-top-ports', '100', '-silent', '-json', '-o', ctx.jsonFile];
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
    getCommandArgs(ctx) {
      const hostsFile = discoveredHostsFile(ctx);
      return hostsFile
        ? ['-l', hostsFile, '-silent', '-json', '-o', ctx.jsonFile]
        : ['-u', ctx.domain, '-silent', '-json', '-o', ctx.jsonFile];
    },
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
    getCommandArgs(ctx) {
      const hostsFile = discoveredHostsFile(ctx);
      const targetArgs = hostsFile ? ['-l', hostsFile] : ['-u', ctx.targetUrl];
      return [...targetArgs, '-title', '-tech-detect', '-status-code', '-silent', '-json', '-o', ctx.jsonFile, ...authHeaderArgs(ctx)];
    },
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

          const isCloudflareChallenge = (
            (typeof data.title === 'string' && /just a moment/i.test(data.title)) ||
            (data['status_code'] === 403 && (tech.toLowerCase().includes('cloudflare') || String(data.webserver).toLowerCase().includes('cloudflare')))
          );
          if (isCloudflareChallenge) {
            findings.push({
              id: 'cloudflare-waf-challenge',
              name: 'Cloudflare WAF Challenge Interstitial Detected',
              severity: 'medium',
              scanner: 'httpx',
              url: data.url || data.host || ctx.targetUrl,
              description: 'Target is actively presenting a Cloudflare Managed Challenge ("Just a moment..."). Automated web crawlers and fuzzers (Katana, FFUF, Dalfox) receive HTTP 403 Forbidden without interactive browser JavaScript execution or valid session cookies.',
              remediation: 'Supply an Authenticated Scan Profile with valid session cookies (e.g. cf_clearance) or configure Cloudflare WAF IP Access Rules / Custom Skip Rules for the scanner source IP.',
              timestamp: data.timestamp || new Date().toISOString(),
            });
          }
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
      if (openPorts.length === 0) return [];

      const findings: Record<string, unknown>[] = [];
      const targetLocation = ctx.domain || ctx.targetUrl || '';

      const sensitiveRules = [
        {
          pattern: /\b(3306|5432|1433|1521|27017|6379|9200)\/tcp\s+open\b/i,
          id: 'nmap-exposed-database',
          name: 'Exposed Database Listener Detected',
          severity: 'high',
          desc: 'Direct exposure of database services to the public internet enables unauthorized credential brute-force, potential authentication bypass, and remote exploit exposure.'
        },
        {
          pattern: /\b(21|23|69|512|513|514)\/tcp\s+open\b/i,
          id: 'nmap-unencrypted-service',
          name: 'Insecure Cleartext Protocol Exposed (FTP/Telnet)',
          severity: 'medium',
          desc: 'Cleartext management or file transfer service exposed publicly. Credentials and payloads are transmitted without mandatory transport layer encryption.'
        },
        {
          pattern: /\b(3389|5900|5901)\/tcp\s+open\b/i,
          id: 'nmap-remote-desktop',
          name: 'Remote Desktop Protocol (RDP/VNC) Exposed',
          severity: 'medium',
          desc: 'Direct graphical remote desktop access listener exposed to public network.'
        }
      ];

      for (const rule of sensitiveRules) {
        const matches = openPorts.filter(line => rule.pattern.test(line));
        if (matches.length > 0) {
          findings.push({
            id: rule.id,
            name: rule.name,
            severity: rule.severity,
            scanner: 'nmap',
            url: targetLocation,
            description: `${rule.desc}\n\nDetected Service(s):\n${matches.join('\n')}`,
            remediation: 'Restrict access to trusted IP addresses or localhost using host firewall (UFW/iptables/Windows Defender) or cloud security groups.',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Always include baseline port observation
      findings.push({
        id: 'nmap-open-ports',
        name: 'Nmap Port Observation',
        severity: 'info',
        scanner: 'nmap',
        url: targetLocation,
        description: openPorts.join('\n'),
        timestamp: new Date().toISOString(),
      });

      return findings;
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
    getCommandArgs(ctx) { return ['-u', ctx.targetUrl, '-silent', '-j', '-o', ctx.jsonFile, ...authHeaderArgs(ctx)]; },
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
      const wordlist = resolveWordlist(ctx.settings.wordlistPath as string | undefined);
      if (!wordlist) {
        throw new Error('FFUF wordlist is unavailable. Configure "wordlistPath" in Settings to an existing file.');
      }
      return ['-u', `${ctx.targetUrl.replace(/\/+$/, '')}/FUZZ`, '-w', wordlist, '-v', '-o', ctx.jsonFile, '-of', 'json', ...authHeaderArgs(ctx)];
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
      const executable = String(ctx.bin).replace(/'/g, "''");
      const script = `$p = Start-Process -Wait -PassThru -NoNewWindow -FilePath '${executable}' -ArgumentList ${opts.args.map(a => `'${a.replace(/'/g, "''")}'`).join(', ')}; exit $p.ExitCode`;
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
      const spawnArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript];
      return { executable: 'powershell.exe', args: spawnArgs, useShell: opts.useShell, cwd: opts.cwd };
    },
    parseFindings(ctx) {
      if (!ctx.xmlFile || !fs.existsSync(ctx.xmlFile)) {
        throw new Error('Netsparker artifact missing: the XML report was not generated, so the scan result is inconclusive.');
      }
      const content = fs.readFileSync(ctx.xmlFile, 'utf-8');
      if (!content.trim()) {
        throw new Error('Netsparker artifact is empty: the scan result is inconclusive.');
      }
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
      const isPackaged = typeof electron === 'object' && electron !== null && 'app' in electron
        ? Boolean((electron as { app?: { isPackaged?: boolean } }).app?.isPackaged)
        : false;
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
      if (!fs.existsSync(ctx.jsonFile)) {
        throw new Error('Acunetix artifact missing: the vulnerability JSON was not generated, so the scan result is inconclusive.');
      }
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      let vulns: unknown;
      try {
        vulns = JSON.parse(content);
      } catch (err) {
        throw new Error(
          `Acunetix artifact is malformed: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err }
        );
      }
      if (vulns && !Array.isArray(vulns) && typeof vulns === 'object' && (vulns as Record<string, unknown>).__recon_error) {
        const marker = vulns as Record<string, unknown>;
        throw new Error(`Acunetix scan is inconclusive (${String(marker.code || 'UNKNOWN')}): ${String(marker.message || 'no verifiable result')}`);
      }
      if (!Array.isArray(vulns)) {
        throw new Error('Acunetix artifact is not a vulnerability array; refusing to report a clean result.');
      }
      const findings: Record<string, unknown>[] = [];
      for (const vuln of vulns) {
        if (!vuln || typeof vuln !== 'object') continue;
        const item = vuln as Record<string, unknown>;
        let severity = 'info';
        if (item.severity === 3) severity = 'high';
        else if (item.severity === 2) severity = 'medium';
        else if (item.severity === 1) severity = 'low';

        findings.push({
          id: item.vt_id || item.vuln_id || 'acunetix-finding',
          name: item.vt_name || 'Acunetix Finding',
          severity: severity,
          scanner: 'acunetix',
          url: item.affects_url || item.affects_detail || '',
          description: Array.isArray(item.tags) ? item.tags.join(', ') : '',
          timestamp: new Date().toISOString(),
        });
      }
      return findings;
    }
  },

  dalfox: {
    getCommandArgs(ctx) {
      let target = ctx.targetUrl;
      let inputType = 'url';
      try {
        const scanDir = storage.getScanDir(ctx.scanId);
        const endpointsFile = path.join(scanDir, 'discovered_endpoints.txt');
        if (fs.existsSync(endpointsFile) && fs.statSync(endpointsFile).size > 0) {
          target = endpointsFile;
          inputType = 'file';
        }
      } catch {
        // Fallback to the single target URL.
      }
      return ['scan', target, '--input-type', inputType, '--format', 'json', '-o', ctx.jsonFile, '--no-color', '--timeout', '8', '--workers', '5', '--skip-mining-dict', '--ignore-return', '302,403,404', ...authHeaderArgs(ctx)];
    },
    isSuccessExitCode(code: number | null) {
      // Dalfox v3: 2 = no target could be scanned; the report-based outcome classifier decides coverage.
      return code === 0 || code === 1;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
      const findings: Record<string, unknown>[] = [];

      // Support modern Dalfox structured report object ({ findings: [...], meta: {...} })
      try {
        const fullDoc = JSON.parse(content);
        if (fullDoc && typeof fullDoc === 'object' && Array.isArray(fullDoc.findings)) {
          for (const d of fullDoc.findings) {
            if (d && typeof d === 'object') {
              findings.push({
                id: `dalfox-xss-${d.param || d.data || 'finding'}`,
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
          }
          return findings;
        }
      } catch { /* Fallback to line-delimited stream */ }

      const lines = content.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const items = Array.isArray(item) ? item : [item];
          for (const d of items) {
            if (!d || typeof d !== 'object') continue;
            // Guard against strings, metadata headers, or empty container objects
            if (!d.param && !d.payload && !d.evidence && d.type !== 'VULN' && !d.cwe) continue;
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
      const args = ['-u', ctx.targetUrl, '-oJ', ctx.jsonFile, '-t', '5'];
      const activeVal = ctx.config?.activeValidation as { delaySeconds?: number } | undefined;
      if (activeVal?.delaySeconds) {
        args.push('-d', String(activeVal.delaySeconds));
      }
      const auth = Object.entries(ctx.authHeaders || {})[0];
      if (auth) args.push('--headers', `${auth[0]}: ${auth[1]}`);
      return args;
    },
    isSuccessExitCode(code: number | null) {
      return code === 0 || code === 1;
    },
    getEnv(ctx, env) {
      return {
        ...env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
      };
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
        const cmsName = typeof data?.cms_name === 'string' ? data.cms_name.trim() : '';
        if (!cmsName) return [];
        return [{
          id: 'cmseek-cms',
          name: `CMS Detected: ${cmsName}`,
          severity: Array.isArray(data.vulnerabilities) && data.vulnerabilities.length > 0 ? 'high' : 'info',
          scanner: 'cmseek',
          url: data.url || ctx.targetUrl,
          description: `CMS: ${cmsName} (v${data.cms_version || 'unknown'}). ${Array.isArray(data.vulnerabilities) && data.vulnerabilities.length > 0 ? `Vulns: ${JSON.stringify(data.vulnerabilities)}` : ''}`,
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
        const results = Array.isArray(data.server_scan_results) ? data.server_scan_results : [];

        const asRecord = (value: unknown): Record<string, unknown> | null => (
          value && typeof value === 'object' ? value as Record<string, unknown> : null
        );
        // SSLyze 4.x stores plugin output directly; 6.x wraps it as { status, result }.
        const unwrap = (value: unknown): Record<string, unknown> => {
          const record = asRecord(value);
          if (!record) return {};
          return asRecord(record.result) || record;
        };

        for (const targetResult of results) {
          const resultRecord = asRecord(targetResult) || {};
          const serverLocation = asRecord(resultRecord.server_location) || {};
          const host = typeof serverLocation.hostname === 'string' ? serverLocation.hostname : ctx.domain;
          const scanCommands = asRecord(resultRecord.scan_result) || asRecord(resultRecord.scan_commands_results) || {};

          // Certificate Validation
          const certInfo = unwrap(scanCommands.certificate_info);
          const deployments = Array.isArray(certInfo.certificate_deployments) ? certInfo.certificate_deployments : [];
          for (const deploymentRaw of deployments) {
            const deployment = asRecord(deploymentRaw) || {};
            const validations = Array.isArray(deployment.path_validation_results) ? deployment.path_validation_results : [];
            const chainValidation = asRecord(validations[0]);
            if (chainValidation && chainValidation.was_validation_successful === false) {
              findings.push({
                id: 'sslyze-invalid-certificate',
                name: 'Untrusted or Invalid SSL/TLS Certificate',
                severity: 'high',
                scanner: 'sslyze',
                url: `https://${host}`,
                description: typeof chainValidation.openssl_error_string === 'string'
                  ? chainValidation.openssl_error_string
                  : 'Certificate path validation failed: untrusted root or verification error.',
                timestamp: new Date().toISOString()
              });
            }

            const chain = Array.isArray(deployment.received_certificate_chain) ? deployment.received_certificate_chain : [];
            const leaf = asRecord(chain[0]);
            if (typeof leaf?.not_valid_after === 'string') {
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

          // Insecure Protocols (SSL 2.0 / SSL 3.0 / TLS 1.0 / TLS 1.1)
          const acceptedCipherCount = (cmdKey: string): number => {
            const protoResult = unwrap(scanCommands[cmdKey]);
            if (Array.isArray(protoResult.accepted_cipher_suites)) return protoResult.accepted_cipher_suites.length;
            if (Array.isArray(protoResult.ciphers_supported)) return protoResult.ciphers_supported.length;
            return 0;
          };

          const checkProtocol = (cmdKey: string, protocolName: string, sev: string) => {
            const acceptedCount = acceptedCipherCount(cmdKey);
            if (acceptedCount > 0) {
              findings.push({
                id: `sslyze-${protocolName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-enabled`,
                name: `Deprecated Protocol Enabled: ${protocolName}`,
                severity: sev,
                scanner: 'sslyze',
                url: `https://${host}`,
                description: `${protocolName} is deprecated, insecure, and should be disabled in server configuration. Accepted ciphers: ${acceptedCount}`,
                remediation: `Disable ${protocolName} in web server TLS settings and enforce TLS 1.2 and TLS 1.3 only.`,
                timestamp: new Date().toISOString()
              });
            }
          };

          checkProtocol('ssl_2_0_cipher_suites', 'SSL 2.0', 'high');
          checkProtocol('ssl_3_0_cipher_suites', 'SSL 3.0', 'high');
          checkProtocol('tls_1_0_cipher_suites', 'TLS 1.0', 'medium');
          checkProtocol('tls_1_1_cipher_suites', 'TLS 1.1', 'medium');

          // Legacy / weak cipher suites negotiated on supported protocol versions.
          const legacySuites = new Set<string>();
          const brokenSuites = new Set<string>();
          for (const versionKey of ['tls_1_2_cipher_suites', 'tls_1_3_cipher_suites']) {
            const versionResult = unwrap(scanCommands[versionKey]);
            const accepted = Array.isArray(versionResult.accepted_cipher_suites) ? versionResult.accepted_cipher_suites : [];
            for (const entryRaw of accepted) {
              const entry = asRecord(entryRaw);
              const suite = asRecord(entry?.cipher_suite);
              const name = typeof suite?.name === 'string'
                ? suite.name
                : typeof entry?.name === 'string' ? entry.name : '';
              if (!name) continue;
              if (/RC4|3DES|DES_|NULL|EXPORT/i.test(name)) brokenSuites.add(name);
              else if (versionKey === 'tls_1_2_cipher_suites' && /CBC/i.test(name)) legacySuites.add(name);
            }
          }
          if (brokenSuites.size > 0 || legacySuites.size > 0) {
            const suites = [...brokenSuites, ...legacySuites];
            findings.push({
              id: 'sslyze-weak-cipher-suites',
              name: brokenSuites.size > 0
                ? 'Weak Cipher Suites Enabled (RC4/3DES/NULL/EXPORT)'
                : 'Legacy CBC Cipher Suites Enabled',
              severity: brokenSuites.size > 0 ? 'medium' : 'low',
              scanner: 'sslyze',
              url: `https://${host}`,
              description: `Server accepts ${suites.length} legacy cipher suite(s): ${suites.join(', ')}. Prefer AEAD suites (AES-GCM or ChaCha20-Poly1305) and disable CBC/RC4/3DES where possible.`,
              remediation: 'Restrict the TLS configuration to modern AEAD cipher suites and remove legacy CBC, RC4 and 3DES suites.',
              timestamp: new Date().toISOString()
            });
          }

          // Vulnerability checks
          const heartbleed = unwrap(scanCommands.heartbleed);
          if (heartbleed.is_vulnerable_to_heartbleed === true) {
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

          const robot = unwrap(scanCommands.robot);
          const robotResult = typeof robot.robot_result === 'string' ? robot.robot_result : '';
          if (robotResult && !/NOT_VULNERABLE/i.test(robotResult)) {
            findings.push({
              id: 'sslyze-robot-vulnerable',
              name: 'Vulnerable to Return of Bleichenbacher Attack (ROBOT)',
              severity: 'high',
              scanner: 'sslyze',
              url: `https://${host}`,
              description: `Target server is vulnerable to ROBOT attack: ${robotResult}.`,
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
    getProcessOptions(ctx, opts) {
      const isDocker = opts.executable === 'docker' || path.basename(opts.executable).toLowerCase().replace(/\.exe$/, '') === 'docker';
      if (isDocker) {
        const outBase = path.basename(ctx.jsonFile);
        const resolvedSrc = path.resolve(ctx.targetUrl);
        return {
          executable: opts.executable,
          args: [
            'run', '--rm',
            '-v', `${resolvedSrc}:/src`,
            '-v', `${ctx.outDir}:/out`,
            'semgrep/semgrep',
            'semgrep', 'scan',
            '--config', 'auto',
            '--json',
            '--output', `/out/${outBase}`,
            '/src'
          ],
          useShell: false,
          cwd: opts.cwd
        };
      }
      return opts;
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
    isSuccessExitCode(code: number | null, ctx?: ScannerContext) {
      if (code === 0 || code === 1) return true;
      if (code === 2 && ctx) {
        if (fs.existsSync(ctx.jsonFile) && fs.statSync(ctx.jsonFile).size > 0) return true;
        if (fs.existsSync(ctx.outputFile) && /Schema Loading Error|Failed to load specification/i.test(fs.readFileSync(ctx.outputFile, 'utf-8'))) return true;
      }
      return false;
    },
    getEnv(ctx, env) {
      return {
        ...env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      };
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) {
        if (fs.existsSync(ctx.outputFile)) {
          try {
            const out = fs.readFileSync(ctx.outputFile, 'utf-8');
            if (/Schema Loading Error|Failed to load specification/i.test(out)) {
              return [{
                id: 'schemathesis-no-schema',
                name: 'Schemathesis Notice: No OpenAPI Schema',
                severity: 'info',
                scanner: 'schemathesis',
                url: ctx.targetUrl,
                description: 'Target does not expose an OpenAPI/Swagger contract document at the tested URL. API fuzzing skipped.',
                remediation: 'Provide an OpenAPI schema URL (e.g. /openapi.json or /api-docs) in scan configuration to enable contract fuzzing.',
                timestamp: new Date().toISOString()
              }];
            }
          } catch { /* ignore */ }
        }
        return [];
      }
      try {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8').trim();
        if (!content) return [];
        const data = JSON.parse(content);
        const findings: Record<string, unknown>[] = [];

        const events = Array.isArray(data.events) ? data.events : [];
        for (const evt of events) {
          if (evt.status === 'failure' || evt.status === 'error') {
            const is5xx = Array.isArray(evt.checks) && evt.checks.some((c: { name?: string; status?: string }) => c.name === 'not_a_server_error' && c.status === 'failure');
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

        // Schema load failure or non-API target notice (schemathesis v4 format)
        if (findings.length === 0) {
          const hasSchemaError = (Array.isArray(data.errors) && data.errors.some((e: { title?: string }) => /Schema Loading Error/i.test(e.title || '')))
            || data.stop_reason === 'error'
            || data.exit_code === 2;
          if (hasSchemaError) {
            return [{
              id: 'schemathesis-no-schema',
              name: 'Schemathesis Notice: No OpenAPI Schema',
              severity: 'info',
              scanner: 'schemathesis',
              url: ctx.targetUrl,
              description: 'Target does not expose an OpenAPI/Swagger contract document at the tested URL. API fuzzing skipped.',
              remediation: 'Provide an OpenAPI schema URL (e.g. /openapi.json or /api-docs) in scan configuration to enable contract fuzzing.',
              timestamp: new Date().toISOString()
            }];
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
      const server = (ctx.settings as Record<string, unknown>)?.interactshServer as string | undefined || (ctx.config?.interactshServer as string);
      if (server) {
        args.push('-server', server);
      }
      const token = (ctx.settings as Record<string, unknown>)?.interactshToken as string | undefined || (ctx.config?.interactshToken as string);
      if (token) {
        args.push('-token', token);
      }
      const sessionDir = ctx.outDir || (ctx.jsonFile ? path.dirname(ctx.jsonFile) : undefined);
      const sessionFile = sessionDir ? path.join(sessionDir, 'interactsh_session.yaml') : undefined;
      if (sessionFile) {
        args.push('-sf', sessionFile);
      }
      return args;
    },
    isSuccessExitCode(code: number | null) {
      return code === 0;
    },
    parseFindings(ctx) {
      if (!fs.existsSync(ctx.jsonFile)) return [];
      try {
        const content = fs.readFileSync(ctx.jsonFile, 'utf-8');
        return parseInteractsh(content, ctx);
      } catch (err) {
        logger.warn(`Failed to parse Interactsh output: ${err}`);
        return [];
      }
    }
  }
};

export function parseSyft(content: string, ctx: Pick<ScannerContext, 'targetUrl'>) {
  if (!content.trim()) return [];
  let data: {
    artifacts?: Array<{
      name?: string;
      version?: string;
      purl?: string;
      type?: string;
      licenses?: unknown[];
      license?: unknown;
      locations?: unknown[];
    }>;
    source?: { target?: string };
  };
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
    const licenseNames = licenses.map((l: unknown) => {
      if (typeof l === 'string') return l;
      if (l && typeof l === 'object') {
        const obj = l as { value?: string; spdxExpression?: string };
        return obj.value || obj.spdxExpression || JSON.stringify(l);
      }
      return '';
    }).filter(Boolean);

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
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) {
      // Gracefully ignore non-JSON startup banners or telemetry lines from interactsh-client
      continue;
    }

    let item: Record<string, unknown>;
    try {
      item = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(`Malformed Interactsh JSON: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
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

function _genericJsonLinesParser(ctx: ScannerContext) {
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

export const hasAdapter = (scannerName: string): boolean => {
  if (typeof scannerName !== 'string' || !scannerName) return false;
  if (!Object.prototype.hasOwnProperty.call(ScannerAdapters, scannerName)) return false;
  const adapter = ScannerAdapters[scannerName];
  return Boolean(adapter) && typeof adapter.getCommandArgs === 'function';
};

export const getAdapter = (scannerName: string): IScannerAdapter => {
  if (!hasAdapter(scannerName)) {
    throw new Error(`No scanner adapter registered for '${scannerName}'. Refusing to launch an unverified command.`);
  }
  return ScannerAdapters[scannerName];
};
