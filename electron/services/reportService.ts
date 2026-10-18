import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { dbService } from './database';
import { logger } from './logger';
import { shell } from 'electron';
import type {WorkflowRef} from '../../src/types/workflow';

export interface ReportData {
  workflow?: WorkflowRef;
  scanId: string;
  target: string;
  status: string;
  startTime: string;
  endTime?: string;
  toolsUsed: string[];
  findings: Array<{
    id?: string;
    scanner: string;
    name: string;
    severity: string;
    url?: string;
    description?: string;
    rawJson?: Record<string, unknown>;
  }>;
  aiAnalysis?: string;
}

export class ReportService {
  private baseDir: string;
  private reportsDir: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), 'Documents', 'SecOpsScans');
    this.reportsDir = path.join(this.baseDir, 'reports');
  }

  async compileReportData(scanId: string): Promise<ReportData> {
    const scan = dbService.getScanById(scanId);
    if (!scan) {
      throw new Error(`Scan not found: ${scanId}`);
    }

    const findings = dbService.getFindings(scanId);
    
    // Check if AI analysis exists in scan dir
    let aiAnalysis = '';
    const aiPath = path.join(this.reportsDir, scanId, 'ai_analysis.txt');
    if (fs.existsSync(aiPath)) {
      try {
        aiAnalysis = fs.readFileSync(aiPath, 'utf8');
      } catch {
        // ignore
      }
    }

    return {
      workflow: (scan.config as {workflow?:WorkflowRef})?.workflow,
      scanId,
      target: String(scan.target || 'Unknown Target'),
      status: String(scan.status || 'UNKNOWN'),
      startTime: String(scan.startTime || new Date().toISOString()),
      endTime: scan.endTime ? String(scan.endTime) : undefined,
      toolsUsed: (scan.config as { tools?: string[] })?.tools || [],
      findings,
      aiAnalysis
    };
  }

  calculateStats(findings: ReportData['findings'], scanStatus?: string) {
    let critical = 0, high = 0, medium = 0, low = 0, info = 0;
    for (const f of findings) {
      const sev = (f.severity || 'info').toLowerCase();
      if (sev === 'critical') critical++;
      else if (sev === 'high') high++;
      else if (sev === 'medium') medium++;
      else if (sev === 'low') low++;
      else info++;
    }

    const total = findings.length;
    // Weighted risk score (0-100 max scale)
    const rawScore = (critical * 10) + (high * 6) + (medium * 3) + (low * 1);
    const riskScore = Math.min(100, rawScore);

    let grade = 'A';
    let gradeColor = '#10b981';

    // If scan failed or was aborted prematurely, do not award a deceptive Grade A
    const normStatus = (scanStatus || '').toUpperCase();
    if (normStatus === 'FAILED' || normStatus === 'STOPPED' || normStatus === 'CANCELLED') {
      grade = 'N/A';
      gradeColor = '#64748b';
    } else if (critical > 0 || riskScore >= 50) {
      grade = 'F';
      gradeColor = '#ef4444';
    } else if (high > 1 || riskScore >= 35) {
      grade = 'D';
      gradeColor = '#f97316';
    } else if (high === 1 || medium > 3 || riskScore >= 20) {
      grade = 'C';
      gradeColor = '#f59e0b';
    } else if (medium > 0 || low > 5 || riskScore >= 10) {
      grade = 'B';
      gradeColor = '#3b82f6';
    }

    return { critical, high, medium, low, info, total, riskScore, grade, gradeColor };
  }

  async generateHtmlReport(scanId: string): Promise<string> {
    const data = await this.compileReportData(scanId);
    const stats = this.calculateStats(data.findings, data.status);
    const scanDir = path.join(this.reportsDir, scanId);
    if (!fs.existsSync(scanDir)) fs.mkdirSync(scanDir, { recursive: true });

    const reportPath = path.join(scanDir, `Executive_Report_${scanId}.html`);

    // Sort findings by severity (critical > high > medium > low > info)
    const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const sortedFindings = [...data.findings].sort((a, b) => {
      const aWeight = SEV_ORDER[(a.severity || 'info').toLowerCase()] ?? 5;
      const bWeight = SEV_ORDER[(b.severity || 'info').toLowerCase()] ?? 5;
      return aWeight - bWeight;
    });

    const findingsHtml = sortedFindings.map((f, i) => {
      const sev = (f.severity || 'info').toLowerCase();
      const sevBadgeColors: Record<string, string> = {
        critical: 'background:#f43f5e; color:#fff;',
        high: 'background:#ef4444; color:#fff;',
        medium: 'background:#f59e0b; color:#000;',
        low: 'background:#10b981; color:#fff;',
        info: 'background:#3b82f6; color:#fff;',
      };
      const badgeStyle = sevBadgeColors[sev] || 'background:#64748b; color:#fff;';

      return `
        <div class="finding-card" style="background:#111a2e; border:1px solid #1e293b; border-radius:12px; margin-bottom:14px; padding:18px; transition:border-color 0.2s;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="${badgeStyle} font-size:11px; font-weight:800; padding:3px 10px; border-radius:20px; text-transform:uppercase;">${sev}</span>
              <span style="color:#f8fafc; font-weight:700; font-size:15px;">#${i + 1} - ${escapeHtml(f.name || 'Vulnerability Finding')}</span>
            </div>
            <span style="background:#1e293b; color:#94a3b8; font-family:monospace; font-size:11px; padding:4px 8px; border-radius:6px;">${escapeHtml(f.scanner)}</span>
          </div>
          ${f.url ? `<div style="font-family:monospace; font-size:12px; color:#38bdf8; margin-bottom:8px; word-break:break-all;"><strong>URL:</strong> ${escapeHtml(f.url)}</div>` : ''}
          ${f.description ? `<div style="font-size:13px; color:#94a3b8; line-height:1.6; margin-bottom:8px;">${escapeHtml(f.description)}</div>` : ''}
          ${f.id ? `<div style="font-family:monospace; font-size:11px; color:#64748b;">Finding ID / Template: ${escapeHtml(f.id)}</div>` : ''}
        </div>
      `;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Assessment Report - ${escapeHtml(data.target)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#070c17; color:#f8fafc; margin:0; padding:30px; }
    .container { max-width: 1050px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #111a2e 0%, #1e1b4b 100%); border:1px solid #334155; border-radius:18px; padding:30px; margin-bottom:25px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 25px; }
    .stat-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; padding: 18px; text-align: center; }
    .stat-val { font-size: 28px; font-weight: 800; font-family: monospace; margin-top: 4px; }
    .score-badge { display:inline-block; font-size:36px; font-weight:900; color:${stats.gradeColor}; border:3px solid ${stats.gradeColor}; width:60px; height:60px; line-height:56px; border-radius:50%; text-align:center; box-shadow:0 0 20px ${stats.gradeColor}40; }
    
    @media print {
      body { background: #ffffff !important; color: #0f172a !important; padding: 12px !important; }
      .container { max-width: 100% !important; margin: 0 !important; }
      .header { background: #f8fafc !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important; box-shadow: none !important; page-break-after: avoid; }
      .header h1 { color: #0f172a !important; }
      .stat-card { background: #f8fafc !important; border: 1px solid #cbd5e1 !important; }
      .score-badge { box-shadow: none !important; }
      .finding-card { background: #ffffff !important; border: 1px solid #cbd5e1 !important; page-break-inside: avoid; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span style="background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid rgba(59,130,246,0.4); font-size:11px; font-weight:bold; padding:4px 10px; border-radius:20px; text-transform:uppercase;">EXECUTIVE AUDIT REPORT</span>
          <h1 style="font-size:26px; font-weight:800; margin:10px 0 6px 0; color:#fff;">Target: ${escapeHtml(data.target)}</h1>
          <p style="margin:0; font-size:13px; color:#94a3b8; font-family:monospace;">Scan ID: ${escapeHtml(data.scanId)} | Started: ${escapeHtml(data.startTime)} | Status: ${escapeHtml(data.status)}</p>
          ${data.workflow ? `<p style="color:#94a3b8">Workflow: ${escapeHtml(data.workflow.kind)} | Source scan: ${escapeHtml(data.workflow.sourceScanId)} | Source item: ${escapeHtml(String(data.workflow.findingId ?? data.workflow.endpointId))}. Retest output does not automatically establish remediation.</p>` : ''}
        </div>
        <div style="text-align:center;">
          <div class="score-badge">${stats.grade}</div>
          <div style="font-size:11px; font-weight:bold; color:#94a3b8; margin-top:6px;">RISK SCORE: ${stats.riskScore}/100</div>
        </div>
      </div>
      <div style="margin-top:16px; padding-top:14px; border-top:1px solid #334155; font-size:12px; color:#cbd5e1;">
        <strong>Engines Deployed:</strong> ${data.toolsUsed.length > 0 ? escapeHtml(data.toolsUsed.join(', ')) : 'Automated Suite'}
      </div>
    </div>

    <!-- Methodology & Assessment Scope Notice -->
    <div style="background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:16px; margin-bottom:24px; font-size:12px; color:#94a3b8; line-height:1.6;">
      <strong style="color:#cbd5e1;">Assessment Scope & Scoring Methodology:</strong><br>
      • <strong>Assessment Window:</strong> ${escapeHtml(data.startTime)}${data.endTime ? ` to ${escapeHtml(data.endTime)}` : ' (In Progress / Interrupted)'} | <strong>Status:</strong> ${escapeHtml(data.status)}<br>
      • <strong>Engines Deployed:</strong> ${data.toolsUsed.length > 0 ? escapeHtml(data.toolsUsed.join(', ')) : 'Automated Suite'}<br>
      • <strong>Scoring Notice:</strong> The Risk Score (${stats.riskScore}/100) is an internal operational prioritization index (Critical: 10, High: 6, Medium: 3, Low: 1) and is distinct from official CVSS, EPSS, or CISA KEV scores.<br>
      • <strong>Assurance Notice:</strong> Failed or stopped scans are flagged as Grade N/A and do not indicate a clean target posture.
    </div>

    <!-- Severity Summary -->
    <div class="grid">
      <div class="stat-card" style="border-top: 3px solid #f43f5e;">
        <div style="font-size:11px; font-weight:bold; color:#f43f5e; text-transform:uppercase;">Critical</div>
        <div class="stat-val" style="color:#f43f5e;">${stats.critical}</div>
      </div>
      <div class="stat-card" style="border-top: 3px solid #ef4444;">
        <div style="font-size:11px; font-weight:bold; color:#ef4444; text-transform:uppercase;">High</div>
        <div class="stat-val" style="color:#ef4444;">${stats.high}</div>
      </div>
      <div class="stat-card" style="border-top: 3px solid #f59e0b;">
        <div style="font-size:11px; font-weight:bold; color:#f59e0b; text-transform:uppercase;">Medium</div>
        <div class="stat-val" style="color:#f59e0b;">${stats.medium}</div>
      </div>
      <div class="stat-card" style="border-top: 3px solid #10b981;">
        <div style="font-size:11px; font-weight:bold; color:#10b981; text-transform:uppercase;">Low</div>
        <div class="stat-val" style="color:#10b981;">${stats.low}</div>
      </div>
      <div class="stat-card" style="border-top: 3px solid #3b82f6;">
        <div style="font-size:11px; font-weight:bold; color:#3b82f6; text-transform:uppercase;">Info</div>
        <div class="stat-val" style="color:#3b82f6;">${stats.info}</div>
      </div>
    </div>

    ${data.aiAnalysis ? `
    <div style="background:#13122b; border:1px solid #6366f1; border-radius:14px; padding:22px; margin-bottom:25px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3 style="margin:0; color:#a5b4fc; font-size:16px;">AI Security Analyst Assessment</h3>
        <span style="font-size:10px; background:rgba(99,102,241,0.2); color:#a5b4fc; padding:2px 8px; border-radius:10px; text-transform:uppercase; font-weight:bold;">Advisory Only</span>
      </div>
      <div style="font-size:13px; color:#cbd5e1; line-height:1.7; white-space:pre-wrap; font-family:monospace;">${escapeHtml(data.aiAnalysis)}</div>
      <div style="margin-top:10px; font-size:11px; color:#64748b;">Disclaimer: AI analysis is generated via local model inference for advisory contextual assistance. It does not alter verified finding severities.</div>
    </div>` : ''}

    <!-- Findings Section -->
    <div style="margin-top:30px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="font-size:18px; font-weight:700; margin:0;">Detailed Findings (${data.findings.length})</h2>
        <span style="font-size:12px; color:#94a3b8;">Sorted by Severity</span>
      </div>
      ${data.findings.length === 0 ? '<div style="text-align:center; padding:40px; background:#0f172a; border-radius:14px; color:#94a3b8;">No security vulnerabilities detected during this assessment.</div>' : findingsHtml}
    </div>

    <footer style="margin-top:40px; padding-top:20px; border-top:1px solid #1e293b; text-align:center; font-size:12px; color:#64748b;">
      Generated by SecOps Recon App &copy; ${new Date().getFullYear()} - Confidential Security Report
    </footer>
  </div>
</body>
</html>`;

    await fsPromises.writeFile(reportPath, html, 'utf8');
    logger.info(`Generated HTML Report at ${reportPath}`);
    return reportPath;
  }

  async generateMarkdownReport(scanId: string): Promise<string> {
    const data = await this.compileReportData(scanId);
    const stats = this.calculateStats(data.findings);
    const scanDir = path.join(this.reportsDir, scanId);
    if (!fs.existsSync(scanDir)) fs.mkdirSync(scanDir, { recursive: true });

    const reportPath = path.join(scanDir, `SECURITY_REPORT_${scanId}.md`);

    let md = `# Security Assessment Report: ${data.target}\n\n`;
    md += `**Target:** \`${data.target}\`  \n`;
    md += `**Scan ID:** \`${data.scanId}\`  \n`;
    if (data.workflow) md += `**Workflow:** ${data.workflow.kind}; source scan: ${data.workflow.sourceScanId}; source item: ${data.workflow.findingId ?? data.workflow.endpointId}. Retest does not automatically establish remediation.\n\n`;
    md += `**Generated:** ${new Date().toISOString()}  \n`;
    md += `**Overall Security Grade:** **${stats.grade}** (Risk Score: ${stats.riskScore}/100)  \n\n`;

    md += `> **Notice**: Risk Score is an internal operational index (Critical: 10, High: 6, Medium: 3, Low: 1) and does not represent an official CVSS or EPSS score.\n\n`;

    md += `## Executive Summary\n\n`;
    md += `| Severity | Count |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Critical** | ${stats.critical} |\n`;
    md += `| **High** | ${stats.high} |\n`;
    md += `| **Medium** | ${stats.medium} |\n`;
    md += `| **Low** | ${stats.low} |\n`;
    md += `| **Info** | ${stats.info} |\n`;
    md += `| **Total** | **${stats.total}** |\n\n`;

    if (data.aiAnalysis) {
      md += `## AI Security Analyst Assessment\n\n`;
      md += `*Advisory context only. Severities are determined by scanner evidence.*\n\n`;
      md += `${data.aiAnalysis}\n\n`;
    }

    md += `## Detailed Findings\n\n`;
    if (data.findings.length === 0) {
      md += `*No vulnerabilities identified during this scan.*\n`;
    } else {
      data.findings.forEach((f, idx) => {
        md += `### ${idx + 1}. [${(f.severity || 'INFO').toUpperCase()}] ${f.name || 'Finding'}\n\n`;
        md += `- **Scanner:** \`${f.scanner}\`\n`;
        if (f.url) md += `- **Affected URL:** \`${f.url}\`\n`;
        if (f.id) md += `- **Finding ID:** \`${f.id}\`\n`;
        if (f.description) md += `- **Description:** ${f.description}\n`;
        md += `\n---\n\n`;
      });
    }

    await fsPromises.writeFile(reportPath, md, 'utf8');
    logger.info(`Generated Markdown Report at ${reportPath}`);
    return reportPath;
  }

  async exportJsonReport(scanId: string): Promise<string> {
    const data = await this.compileReportData(scanId);
    const stats = this.calculateStats(data.findings);
    const scanDir = path.join(this.reportsDir, scanId);
    if (!fs.existsSync(scanDir)) fs.mkdirSync(scanDir, { recursive: true });

    const reportPath = path.join(scanDir, `findings_${scanId}.json`);
    const payload = {
      ...data,
      metrics: stats,
      scoringNotice: 'Risk score is an internal weighted risk index (0-100) and is not an official CVSS or EPSS metric.',
      exportedAt: new Date().toISOString()
    };

    await fsPromises.writeFile(reportPath, JSON.stringify(payload, null, 2), 'utf8');
    logger.info(`Exported JSON Report at ${reportPath}`);
    return reportPath;
  }

  async exportSarifReport(scanId: string): Promise<string> {
    const data = await this.compileReportData(scanId);
    const scanDir = path.join(this.reportsDir, scanId);
    if (!fs.existsSync(scanDir)) fs.mkdirSync(scanDir, { recursive: true });

    const reportPath = path.join(scanDir, `findings_${scanId}.sarif`);

    const mapSarifLevel = (severity?: string): 'error' | 'warning' | 'note' | 'none' => {
      const s = (severity || 'info').toLowerCase();
      if (s === 'critical' || s === 'high') return 'error';
      if (s === 'medium' || s === 'low') return 'warning';
      return 'note';
    };

    const rulesMap = new Map<string, { id: string; name: string; shortDescription: { text: string }; defaultConfiguration: { level: 'error' | 'warning' | 'note' | 'none' } }>();
    
    for (const f of data.findings) {
      const ruleId = f.id || `${f.scanner}-${(f.name || 'finding').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      if (!rulesMap.has(ruleId)) {
        rulesMap.set(ruleId, {
          id: ruleId,
          name: f.name || 'Security Finding',
          shortDescription: { text: f.name || 'Security Finding' },
          defaultConfiguration: {
            level: mapSarifLevel(f.severity)
          }
        });
      }
    }

    const sarifPayload = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'SecOps Recon App',
              version: '2.0.0',
              informationUri: 'https://github.com/SecOps/recon-app',
              rules: Array.from(rulesMap.values())
            }
          },
          invocations: [
            {
              executionSuccessful: data.status !== 'FAILED',
              startTimeUtc: data.startTime,
              endTimeUtc: data.endTime || new Date().toISOString()
            }
          ],
          results: data.findings.map(f => {
            const ruleId = f.id || `${f.scanner}-${(f.name || 'finding').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            return {
              ruleId,
              level: mapSarifLevel(f.severity),
              message: {
                text: f.description || f.name || 'Security Finding'
              },
              locations: f.url ? [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: f.url
                    }
                  }
                }
              ] : undefined,
              properties: {
                scanner: f.scanner,
                originalSeverity: f.severity,
                target: data.target
              }
            };
          })
        }
      ]
    };

    await fsPromises.writeFile(reportPath, JSON.stringify(sarifPayload, null, 2), 'utf8');
    logger.info(`Exported SARIF Report at ${reportPath}`);
    return reportPath;
  }
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const reportService = new ReportService();
