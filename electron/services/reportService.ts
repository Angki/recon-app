import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { dbService } from './database';
import { logger } from './logger';
import type { WorkflowRef } from '../../src/types/workflow';
export type AssessmentStatus =
  | 'COMPLETED_CLEAN'
  | 'COMPLETED_WITH_FINDINGS'
  | 'PARTIAL_COVERAGE'
  | 'FAILED'
  | 'CANCELLED'
  | 'INTERRUPTED'
  | 'IN_PROGRESS'
  | 'NOT_ASSESSED';

export interface EngineReportStatus {
  status: string;
  reason?: string;
  exitCode?: number | null;
  artifactPath?: string;
  resultCount?: number;
  durationMs?: number;
}

export interface AssessmentMetrics {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
  riskScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';
  gradeColor: string;
  assessmentStatus: AssessmentStatus;
  assessmentLabel: string;
  coverageStatus: 'FULL' | 'PARTIAL' | 'NONE';
  toolsRequested: number;
  toolsCompleted: number;
  toolsPartial: number;
  toolsSkipped: number;
  toolsFailed: number;
  coverageLimitation: string;
}

export interface ReportData {
  workflow?: WorkflowRef;
  scanId: string;
  target: string;
  status: string;
  startTime: string;
  endTime?: string;
  toolsUsed: string[];
  toolStatuses?: Record<string, string>;
  engineStatuses?: Record<string, EngineReportStatus>;
  findings: Array<{
    id?: string;
    scanner: string;
    name: string;
    severity: string;
    url?: string;
    description?: string;
    evidence?: unknown;
    httpRequest?: string;
    httpResponse?: string;
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

    const scanRecord = scan as Record<string, unknown>;
    const configuredTools: string[] = (scan.config as { tools?: string[] })?.tools || [];
    const rawEngineStatuses = scanRecord.engineStatuses;
    const engineStatuses: Record<string, EngineReportStatus> =
      rawEngineStatuses && typeof rawEngineStatuses === 'object' && !Array.isArray(rawEngineStatuses)
        ? (rawEngineStatuses as Record<string, EngineReportStatus>)
        : {};
    const toolsUsed = [...configuredTools];
    for (const engine of Object.keys(engineStatuses)) {
      if (!toolsUsed.includes(engine)) toolsUsed.push(engine);
    }
    const toolStatuses: Record<string, string> = {};
    for (const t of toolsUsed) {
      toolStatuses[t] = String(engineStatuses[t]?.status || scanRecord[`${t}Status`] || 'UNKNOWN');
    }

    return {
      workflow: (scan.config as {workflow?:WorkflowRef})?.workflow,
      scanId,
      target: String(scan.target || 'Unknown Target'),
      status: String(scan.status || 'UNKNOWN'),
      startTime: String(scan.startTime || new Date().toISOString()),
      endTime: scan.endTime ? String(scan.endTime) : undefined,
      toolsUsed,
      toolStatuses,
      engineStatuses,
      findings: findings as ReportData['findings'],
      aiAnalysis
    };
  }

  calculateStats(
    findings: ReportData['findings'],
    scanStatus?: string,
    toolsUsed?: string[],
    toolStatuses?: Record<string, string>
  ): AssessmentMetrics {
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
    const rawScore = (critical * 10) + (high * 6) + (medium * 3) + (low * 1);
    const riskScore = Math.min(100, rawScore);

    const normStatus = (scanStatus || '').toUpperCase();
    const inferredTools = findings.length > 0
      ? Array.from(new Set(findings.map(f => f.scanner || 'scanner')))
      : normStatus === 'COMPLETED'
      ? ['scanner']
      : [];
    const tools = toolsUsed !== undefined ? toolsUsed : inferredTools;
    const toolsRequested = tools.length;
    let toolsCompleted = 0;
    let toolsPartial = 0;
    let toolsSkipped = 0;
    let toolsFailed = 0;

    if (toolStatuses && toolsRequested > 0) {
      for (const t of tools) {
        const s = (toolStatuses[t] || '').toUpperCase();
        if (s === 'COMPLETED') toolsCompleted++;
        else if (s === 'DEGRADED' || s === 'PARTIAL') toolsPartial++;
        else if (s === 'SKIPPED') toolsSkipped++;
        else if (s === 'FAILED' || s === 'STOPPED' || s === 'CANCELLED') toolsFailed++;
      }
    } else if (normStatus === 'COMPLETED') {
      toolsCompleted = toolsRequested;
    }

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';
    let gradeColor: string;
    let assessmentStatus: AssessmentStatus;
    let assessmentLabel: string;
    let coverageStatus: 'FULL' | 'PARTIAL' | 'NONE';
    let coverageLimitation: string;

    const isNonTerminalOrActive = ['RUNNING', 'VALIDATING', 'PARSING', 'QUEUED'].includes(normStatus);
    const isInterruptedOrStopped = ['STOPPED', 'CANCELLED', 'INTERRUPTED'].includes(normStatus);
    const isFailed = normStatus === 'FAILED';

    if (toolsRequested === 0 && total === 0) {
      grade = 'N/A';
      gradeColor = '#64748b';
      assessmentStatus = 'NOT_ASSESSED';
      assessmentLabel = 'Not Assessed (Zero Tools Run)';
      coverageStatus = 'NONE';
      coverageLimitation = 'No security tools were selected or executed on target.';
    } else if (isFailed) {
      grade = 'N/A';
      gradeColor = '#ef4444';
      assessmentStatus = 'FAILED';
      assessmentLabel = 'Assessment Failed';
      coverageStatus = 'NONE';
      coverageLimitation = 'Scan execution failed with error. Results are incomplete and cannot be used for security assurance.';
    } else if (isInterruptedOrStopped) {
      grade = 'N/A';
      gradeColor = '#64748b';
      assessmentStatus = 'CANCELLED';
      assessmentLabel = 'Assessment Cancelled / Interrupted';
      coverageStatus = 'PARTIAL';
      coverageLimitation = 'Scan was stopped or interrupted before all engines completed. Findings do not reflect full scope.';
    } else if (isNonTerminalOrActive) {
      grade = 'N/A';
      gradeColor = '#3b82f6';
      assessmentStatus = 'IN_PROGRESS';
      assessmentLabel = 'Assessment In Progress';
      coverageStatus = 'PARTIAL';
      coverageLimitation = 'Scan is actively executing. Interim findings do not represent a final assessment.';
    } else if (toolsFailed > 0 || toolsPartial > 0 || toolsSkipped > 0 || (toolsCompleted < toolsRequested && normStatus !== 'COMPLETED')) {
      coverageStatus = 'PARTIAL';
      assessmentStatus = 'PARTIAL_COVERAGE';
      if (total === 0) {
        grade = 'N/A';
        gradeColor = '#f59e0b';
        assessmentLabel = 'Inconclusive (Partial Coverage)';
        coverageLimitation = `Scan completed partially (${toolsCompleted}/${toolsRequested} tools fully succeeded, ${toolsPartial} degraded, ${toolsSkipped} skipped, ${toolsFailed} failed). Zero findings does not imply the target is secure.`;
      } else {
        if (critical > 0 || riskScore >= 50) { grade = 'F'; gradeColor = '#ef4444'; }
        else if (high > 1 || riskScore >= 35) { grade = 'D'; gradeColor = '#f97316'; }
        else if (high === 1 || medium > 3 || riskScore >= 20) { grade = 'C'; gradeColor = '#f59e0b'; }
        else if (medium > 0 || low > 5 || riskScore >= 10) { grade = 'B'; gradeColor = '#3b82f6'; }
        else { grade = 'B'; gradeColor = '#3b82f6'; }
        assessmentLabel = `${grade} (Partial Coverage)`;
        coverageLimitation = `Some engines were degraded, skipped, or failed (${toolsPartial} degraded, ${toolsSkipped} skipped, ${toolsFailed} failed). Additional vulnerabilities may exist in unassessed areas.`;
      }
    } else if (normStatus === 'COMPLETED') {
      coverageStatus = 'FULL';
      if (total === 0) {
        grade = 'A';
        gradeColor = '#10b981';
        assessmentStatus = 'COMPLETED_CLEAN';
        assessmentLabel = 'Clean (Tested Scope Only)';
        coverageLimitation = 'No vulnerabilities identified within tested scanner coverage. This assessment does not guarantee absence of unassessed vulnerability classes or zero-day exploits.';
      } else {
        if (critical > 0 || riskScore >= 50) { grade = 'F'; gradeColor = '#ef4444'; }
        else if (high > 1 || riskScore >= 35) { grade = 'D'; gradeColor = '#f97316'; }
        else if (high === 1 || medium > 3 || riskScore >= 20) { grade = 'C'; gradeColor = '#f59e0b'; }
        else if (medium > 0 || low > 5 || riskScore >= 10) { grade = 'B'; gradeColor = '#3b82f6'; }
        else { grade = 'B'; gradeColor = '#3b82f6'; }
        assessmentStatus = 'COMPLETED_WITH_FINDINGS';
        assessmentLabel = `${grade} - ${grade === 'F' ? 'Critical Risk' : grade === 'D' ? 'High Risk' : grade === 'C' ? 'Moderate Risk' : 'Low Risk'}`;
        coverageLimitation = 'Findings verified within tested scope. Remediate according to severity priority.';
      }
    } else {
      grade = 'N/A';
      gradeColor = '#64748b';
      assessmentStatus = 'NOT_ASSESSED';
      assessmentLabel = `Status: ${normStatus}`;
      coverageStatus = 'NONE';
      coverageLimitation = `Scan ended with status ${normStatus}. Results do not provide security verification.`;
    }

    return {
      critical,
      high,
      medium,
      low,
      info,
      total,
      riskScore,
      grade,
      gradeColor,
      assessmentStatus,
      assessmentLabel,
      coverageStatus,
      toolsRequested,
      toolsCompleted,
      toolsPartial,
      toolsSkipped,
      toolsFailed,
      coverageLimitation
    };
  }

  async generateHtmlReport(scanId: string): Promise<string> {
    const data = await this.compileReportData(scanId);
    const stats = this.calculateStats(data.findings, data.status, data.toolsUsed, data.toolStatuses);
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
      const evidenceText = f.evidence === undefined || f.evidence === null
        ? ''
        : typeof f.evidence === 'string'
          ? f.evidence
          : JSON.stringify(f.evidence, null, 2);
      const evidenceBlock = evidenceText
        ? `<details style="margin-top:10px;"><summary style="cursor:pointer; font-size:12px; color:#38bdf8; font-weight:600;">HTTP Evidence</summary>
             <pre style="white-space:pre-wrap; word-break:break-all; background:#0b1220; border:1px solid #1e293b; border-radius:8px; padding:10px; font-size:11px; color:#cbd5e1; max-height:320px; overflow:auto;">${escapeHtml(evidenceText.slice(0, 8000))}</pre>
           </details>`
        : '';
      const requestBlock = f.httpRequest
        ? `<details style="margin-top:8px;"><summary style="cursor:pointer; font-size:12px; color:#a5b4fc; font-weight:600;">HTTP Request</summary>
             <pre style="white-space:pre-wrap; word-break:break-all; background:#0b1220; border:1px solid #1e293b; border-radius:8px; padding:10px; font-size:11px; color:#cbd5e1;">${escapeHtml(f.httpRequest.slice(0, 8000))}</pre>
           </details>`
        : '';
      const responseBlock = f.httpResponse
        ? `<details style="margin-top:8px;"><summary style="cursor:pointer; font-size:12px; color:#86efac; font-weight:600;">HTTP Response</summary>
             <pre style="white-space:pre-wrap; word-break:break-all; background:#0b1220; border:1px solid #1e293b; border-radius:8px; padding:10px; font-size:11px; color:#cbd5e1;">${escapeHtml(f.httpResponse.slice(0, 8000))}</pre>
           </details>`
        : '';

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
          ${evidenceBlock}
          ${requestBlock}
          ${responseBlock}
        </div>
      `;
    }).join('\n');

    const coverageBadgeStyle = (status: string) => {
      if (status === 'COMPLETED') return 'background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.4);';
      if (status === 'DEGRADED' || status === 'PARTIAL') return 'background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.4);';
      if (status === 'SKIPPED') return 'background:rgba(148,163,184,0.15); color:#cbd5e1; border:1px solid rgba(148,163,184,0.4);';
      return 'background:rgba(244,63,94,0.15); color:#fb7185; border:1px solid rgba(244,63,94,0.4);';
    };
    const coverageHtml = data.toolsUsed.length === 0
      ? '<tr><td colspan="5" style="padding:12px; color:#94a3b8; text-align:center;">No engines were invoked.</td></tr>'
      : data.toolsUsed.map(engine => {
        const detail = data.engineStatuses?.[engine];
        const status = String(detail?.status || data.toolStatuses?.[engine] || 'UNKNOWN').toUpperCase();
        const duration = typeof detail?.durationMs === 'number' ? `${(detail.durationMs / 1000).toFixed(1)}s` : '-';
        const resultCount = typeof detail?.resultCount === 'number' ? String(detail.resultCount) : '-';
        return `<tr>
          <td style="padding:8px 10px; border-top:1px solid #1e293b; font-family:monospace; color:#e2e8f0;">${escapeHtml(engine)}</td>
          <td style="padding:8px 10px; border-top:1px solid #1e293b;"><span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; text-transform:uppercase; ${coverageBadgeStyle(status)}">${escapeHtml(status)}</span></td>
          <td style="padding:8px 10px; border-top:1px solid #1e293b; color:#cbd5e1; text-align:right; font-family:monospace;">${escapeHtml(resultCount)}</td>
          <td style="padding:8px 10px; border-top:1px solid #1e293b; color:#cbd5e1; text-align:right; font-family:monospace;">${escapeHtml(duration)}</td>
          <td style="padding:8px 10px; border-top:1px solid #1e293b; color:#94a3b8; font-size:11px;">${escapeHtml(detail?.reason || '-')}</td>
        </tr>`;
      }).join('');

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
          <div style="font-size:11px; font-weight:bold; color:#94a3b8; margin-top:6px;">${escapeHtml(stats.assessmentLabel)}</div>
        </div>
      </div>
      <div style="margin-top:16px; padding-top:14px; border-top:1px solid #334155; font-size:12px; color:#cbd5e1;">
        <strong>Engines Deployed:</strong> ${data.toolsUsed.length > 0 ? escapeHtml(data.toolsUsed.join(', ')) : 'None'} (${stats.toolsCompleted}/${stats.toolsRequested} fully covered)
      </div>
    </div>

    <!-- Methodology & Assessment Scope Notice -->
    <div style="background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:16px; margin-bottom:24px; font-size:12px; color:#94a3b8; line-height:1.6;">
      <strong style="color:#cbd5e1;">Assessment Scope, Status & Limitations:</strong><br>
      • <strong>Assessment Status:</strong> ${escapeHtml(stats.assessmentStatus)} (${escapeHtml(stats.assessmentLabel)})<br>
      • <strong>Coverage Posture:</strong> ${escapeHtml(stats.coverageStatus)} (${stats.toolsCompleted}/${stats.toolsRequested} fully covered, ${stats.toolsPartial} degraded, ${stats.toolsSkipped} skipped, ${stats.toolsFailed} failed)<br>
      • <strong>Assurance Limitation:</strong> ${escapeHtml(stats.coverageLimitation)}<br>
      • <strong>Scoring Notice:</strong> The Risk Score (${stats.riskScore}/100) is an internal operational prioritization index (Critical: 10, High: 6, Medium: 3, Low: 1) and is distinct from official CVSS, EPSS, or CISA KEV scores.
    </div>

    <!-- Engine Coverage Matrix -->
    <div style="background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:16px; margin-bottom:24px;">
      <h3 style="margin:0 0 10px 0; font-size:14px; color:#e2e8f0;">Engine Coverage Matrix</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="color:#94a3b8; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.05em;">
            <th style="padding:0 10px 6px 10px;">Engine</th>
            <th style="padding:0 10px 6px 10px;">Status</th>
            <th style="padding:0 10px 6px 10px; text-align:right;">Results</th>
            <th style="padding:0 10px 6px 10px; text-align:right;">Duration</th>
            <th style="padding:0 10px 6px 10px;">Reason</th>
          </tr>
        </thead>
        <tbody>${coverageHtml}</tbody>
      </table>
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
      ${data.findings.length === 0 ? `<div style="text-align:center; padding:40px; background:#0f172a; border-radius:14px; color:#94a3b8;">${stats.assessmentStatus === 'COMPLETED_CLEAN' ? 'No security vulnerabilities detected during this assessment.' : stats.coverageLimitation}</div>` : findingsHtml}
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
    const stats = this.calculateStats(data.findings, data.status, data.toolsUsed, data.toolStatuses);
    const scanDir = path.join(this.reportsDir, scanId);
    if (!fs.existsSync(scanDir)) fs.mkdirSync(scanDir, { recursive: true });

    const reportPath = path.join(scanDir, `SECURITY_REPORT_${scanId}.md`);

    let md = `# Security Assessment Report: ${data.target}\n\n`;
    md += `**Target:** \`${data.target}\`  \n`;
    md += `**Scan ID:** \`${data.scanId}\`  \n`;
    md += `**Assessment Status:** \`${stats.assessmentStatus}\` (${stats.assessmentLabel})  \n`;
    md += `**Overall Security Grade:** **${stats.grade}** (Risk Score: ${stats.riskScore}/100)  \n`;
    md += `**Engines Coverage:** ${stats.toolsCompleted}/${stats.toolsRequested} fully covered, ${stats.toolsPartial} degraded, ${stats.toolsSkipped} skipped, ${stats.toolsFailed} failed (${stats.coverageStatus})  \n`;
    if (data.workflow) md += `**Workflow:** ${data.workflow.kind}; source scan: ${data.workflow.sourceScanId}; source item: ${data.workflow.findingId ?? data.workflow.endpointId}. Retest does not automatically establish remediation.\n\n`;
    md += `**Generated:** ${new Date().toISOString()}  \n\n`;

    md += `> **Scope & Assurance Limitation**: ${stats.coverageLimitation}\n\n`;
    md += `> **Notice**: Risk Score is an internal operational index (Critical: 10, High: 6, Medium: 3, Low: 1) and does not represent an official CVSS or EPSS score.\n\n`;

    md += `## Engine Coverage Matrix\n\n`;
    const mdCell = (value: unknown) => String(value ?? '-').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '-';
    md += `| Engine | Status | Results | Duration | Reason |\n| :--- | :--- | ---: | ---: | :--- |\n`;
    if (data.toolsUsed.length === 0) {
      md += `| - | NOT RUN | - | - | No engines were invoked. |\n`;
    } else {
      for (const engine of data.toolsUsed) {
        const detail = data.engineStatuses?.[engine];
        const status = String(detail?.status || data.toolStatuses?.[engine] || 'UNKNOWN').toUpperCase();
        const duration = typeof detail?.durationMs === 'number' ? `${(detail.durationMs / 1000).toFixed(1)}s` : '-';
        const resultCount = typeof detail?.resultCount === 'number' ? String(detail.resultCount) : '-';
        md += `| ${mdCell(engine)} | ${mdCell(status)} | ${resultCount} | ${duration} | ${mdCell(detail?.reason || '-')} |\n`;
      }
    }
    md += `\n`;

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
        if (f.evidence !== undefined && f.evidence !== null) {
          const evidenceText = typeof f.evidence === 'string' ? f.evidence : JSON.stringify(f.evidence, null, 2);
          md += `\n**Evidence:**\n\n\`\`\`json\n${evidenceText.slice(0, 8000)}\n\`\`\`\n`;
        }
        if (f.httpRequest) md += `\n**HTTP Request:**\n\n\`\`\`http\n${f.httpRequest.slice(0, 8000)}\n\`\`\`\n`;
        if (f.httpResponse) md += `\n**HTTP Response:**\n\n\`\`\`http\n${f.httpResponse.slice(0, 8000)}\n\`\`\`\n`;
        md += `\n---\n\n`;
      });
    }

    await fsPromises.writeFile(reportPath, md, 'utf8');
    logger.info(`Generated Markdown Report at ${reportPath}`);
    return reportPath;
  }

  async exportJsonReport(scanId: string): Promise<string> {
    const data = await this.compileReportData(scanId);
    const stats = this.calculateStats(data.findings, data.status, data.toolsUsed, data.toolStatuses);
    const scanDir = path.join(this.reportsDir, scanId);
    if (!fs.existsSync(scanDir)) fs.mkdirSync(scanDir, { recursive: true });

    const reportPath = path.join(scanDir, `findings_${scanId}.json`);
    const payload = {
      ...data,
      metrics: stats,
      assessmentStatus: stats.assessmentStatus,
      assessmentLabel: stats.assessmentLabel,
      coverageLimitation: stats.coverageLimitation,
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

    const engineNames = [...new Set([
      ...data.toolsUsed,
      ...data.findings.map(f => f.scanner).filter(Boolean)
    ])];
    const runEngines = engineNames.length > 0 ? engineNames : ['recon-app'];
    const ruleIdFor = (f: ReportData['findings'][number]) =>
      f.id || `${f.scanner}-${(f.name || 'finding').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const endTimeUtc = data.endTime || new Date().toISOString();

    const runs = runEngines.map(engine => {
      const detail = data.engineStatuses?.[engine];
      const status = String(
        detail?.status || data.toolStatuses?.[engine] || (engine === 'recon-app' ? data.status : 'UNKNOWN')
      ).toUpperCase();
      const engineFindings = engine === 'recon-app'
        ? data.findings
        : data.findings.filter(f => String(f.scanner || '').toLowerCase() === engine.toLowerCase());

      const engineRules = new Map<string, { id: string; name: string; shortDescription: { text: string }; defaultConfiguration: { level: 'error' | 'warning' | 'note' | 'none' } }>();
      for (const f of engineFindings) {
        const ruleId = ruleIdFor(f);
        if (!engineRules.has(ruleId)) {
          engineRules.set(ruleId, {
            id: ruleId,
            name: f.name || 'Security Finding',
            shortDescription: { text: f.name || 'Security Finding' },
            defaultConfiguration: { level: mapSarifLevel(f.severity) }
          });
        }
      }

      const executionSuccessful = ['COMPLETED', 'DEGRADED', 'PARTIAL'].includes(status);
      const notifications = status === 'COMPLETED'
        ? undefined
        : [{
            level: status === 'FAILED' ? 'error' : 'warning',
            message: {
              text: `${engine} coverage status: ${status}. ${detail?.reason || 'Coverage was reduced or the engine was not applicable.'}`
            },
            timeUtc: endTimeUtc,
            descriptor: { id: `engine-coverage-${status.toLowerCase()}` },
            properties: { scanner: engine, status }
          }];

      return {
        tool: {
          driver: {
            name: `SecOps Recon - ${engine}`,
            version: '2.0.0',
            informationUri: 'https://github.com/SecOps/recon-app',
            rules: Array.from(engineRules.values())
          }
        },
        invocations: [
          {
            executionSuccessful,
            exitCode: typeof detail?.exitCode === 'number' ? detail.exitCode : undefined,
            startTimeUtc: data.startTime,
            endTimeUtc,
            properties: {
              status,
              reason: detail?.reason,
              resultCount: detail?.resultCount,
              durationMs: detail?.durationMs,
              artifactPath: detail?.artifactPath
            },
            ...(notifications ? { toolExecutionNotifications: notifications } : {})
          }
        ],
        results: engineFindings.map(f => {
          const ruleId = ruleIdFor(f);
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
              target: data.target,
              engineStatus: status
            }
          };
        })
      };
    });

    const sarifPayload = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs
    };

    await fsPromises.writeFile(reportPath, JSON.stringify(sarifPayload, null, 2), 'utf8');
    logger.info(`Exported SARIF Report at ${reportPath}`);
    return reportPath;
  }

  async generatePdfReport(scanId: string): Promise<string> {
    const htmlPath = await this.generateHtmlReport(scanId);
    const scanDir = path.join(this.reportsDir, scanId);
    const pdfPath = path.join(scanDir, `Executive_Report_${scanId}.pdf`);

    try {
      const { chromium } = await import('playwright');
      let browser;
      try {
        browser = await chromium.launch({ channel: 'msedge' });
      } catch {
        try {
          browser = await chromium.launch({ channel: 'chrome' });
        } catch {
          browser = await chromium.launch();
        }
      }

      try {
        const page = await browser.newPage();
        await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
        await page.pdf({
          path: pdfPath,
          format: 'A4',
          printBackground: true,
          margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' }
        });
      } finally {
        await browser.close();
      }
      logger.info(`Generated PDF Report at ${pdfPath}`);
      return pdfPath;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to generate PDF report for ${scanId}: ${msg}`);
      throw new Error(`PDF generation failed: ${msg}`, { cause: err });
    }
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
