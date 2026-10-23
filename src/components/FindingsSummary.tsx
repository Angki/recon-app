import { useMemo, useState } from 'react';
import { Globe2, Activity, ShieldCheck, AlertTriangle, ShieldAlert, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import type { Vulnerability } from '../types/vulnerability';

interface FindingsSummaryProps {
  nucleiFindings: { info: number; low: number; medium: number; high: number; critical: number };
  wapitiVulns: number;
  wapitiPages: number;
  allFindings?: Vulnerability[];
  scanStatus?: string;
  selectedTools?: string[];
  scannerStatus?: Record<string, string>;
  scannerReasons?: Record<string, string>;
  activeSeverityFilter?: string;
  onFilterSeverity?: (sev: string) => void;
  compact?: boolean;
}

type CoverageBucket = 'covered' | 'partial' | 'skipped' | 'failed' | 'stopped' | 'running' | 'notRun';

const COVERAGE_META: Record<CoverageBucket, { label: string; badge: string }> = {
  covered: { label: 'Covered', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  partial: { label: 'Partial', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  skipped: { label: 'Skipped', badge: 'border-slate-500/30 bg-slate-500/10 text-slate-300' },
  failed: { label: 'Failed', badge: 'border-rose-500/30 bg-rose-500/10 text-rose-300' },
  stopped: { label: 'Stopped', badge: 'border-slate-500/30 bg-slate-500/10 text-slate-400' },
  running: { label: 'Running', badge: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  notRun: { label: 'Not Run', badge: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400' },
};

function coverageBucket(status: string): CoverageBucket {
  if (status === 'COMPLETED') return 'covered';
  if (status === 'DEGRADED' || status === 'PARTIAL') return 'partial';
  if (status === 'SKIPPED') return 'skipped';
  if (status === 'FAILED') return 'failed';
  if (status === 'STOPPED' || status === 'CANCELLED') return 'stopped';
  if (status === 'RUNNING' || status === 'QUEUED') return 'running';
  return 'notRun';
}

export default function FindingsSummary({
  nucleiFindings,
  wapitiVulns,
  wapitiPages,
  allFindings = [],
  scanStatus = 'IDLE',
  selectedTools = [],
  scannerStatus = {},
  scannerReasons = {},
  activeSeverityFilter = 'all',
  onFilterSeverity,
  compact = false
}: FindingsSummaryProps) {
  const [coverageOpen, setCoverageOpen] = useState(false);
  // Aggregate severities across ALL scanner findings when available, falling back to nuclei
  const counts = useMemo(() => {
    if (allFindings.length > 0) {
      const tally = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const f of allFindings) {
        const sev = (f.severity || 'info').toLowerCase();
        if (sev in tally) {
          tally[sev as keyof typeof tally]++;
        } else {
          tally.info++;
        }
      }
      return tally;
    }
    return nucleiFindings;
  }, [allFindings, nucleiFindings]);

  const totalFindings = allFindings.length > 0
    ? allFindings.length
    : counts.critical + counts.high + counts.medium + counts.low + counts.info + wapitiVulns;

  // Engine coverage matrix: posture always runs, so include it even though it is not user-selectable.
  const coverage = useMemo(() => {
    const engines = Array.from(new Set(['posture', ...selectedTools]));
    const rows = engines.map(engine => {
      const status = (scannerStatus[engine] || 'IDLE').toUpperCase();
      return {
        engine,
        status,
        reason: scannerReasons[engine],
        bucket: coverageBucket(status),
      };
    });
    const tally: Record<CoverageBucket, number> = {
      covered: 0, partial: 0, skipped: 0, failed: 0, stopped: 0, running: 0, notRun: 0
    };
    for (const row of rows) tally[row.bucket]++;
    return { rows, tally };
  }, [selectedTools, scannerStatus, scannerReasons]);

  const incompleteCoverage = coverage.rows.filter(row => row.bucket !== 'covered');

  // Calculate Weighted Risk Score & Assessment Contract
  const securityPosture = useMemo(() => {
    const normStatus = (scanStatus || '').toUpperCase();
    const tools = selectedTools || [];
    let toolsIncomplete = 0;

    for (const t of tools) {
      const s = (scannerStatus[t] || '').toUpperCase();
      if (s !== 'COMPLETED') toolsIncomplete++;
    }

    const postureStatus = scannerStatus.posture !== undefined ? (scannerStatus.posture || '').toUpperCase() : null;
    const postureIncomplete = postureStatus !== null && postureStatus !== 'COMPLETED';

    const isPartialCoverage = toolsIncomplete > 0 || postureIncomplete || normStatus === 'PARTIAL';

    const toolsRequested = tools.length;

    if (totalFindings === 0) {
      if (toolsRequested === 0 || normStatus === 'IDLE') {
        return { grade: 'N/A', label: 'Not Assessed', color: 'text-slate-400', border: 'border-slate-500/30 bg-slate-500/10' };
      }
      if (['RUNNING', 'VALIDATING', 'PARSING', 'QUEUED'].includes(normStatus)) {
        return { grade: 'N/A', label: 'In Progress', color: 'text-blue-400', border: 'border-blue-500/30 bg-blue-500/10' };
      }
      if (normStatus === 'FAILED') {
        return { grade: 'N/A', label: 'Scan Failed', color: 'text-rose-400', border: 'border-rose-500/30 bg-rose-500/10' };
      }
      if (['STOPPED', 'CANCELLED', 'INTERRUPTED'].includes(normStatus)) {
        return { grade: 'N/A', label: 'Interrupted', color: 'text-slate-400', border: 'border-slate-500/30 bg-slate-500/10' };
      }
      if (isPartialCoverage) {
        return { grade: 'N/A', label: 'Inconclusive (Partial)', color: 'text-amber-400', border: 'border-amber-500/30 bg-amber-500/10' };
      }
      if (normStatus === 'COMPLETED') {
        return { grade: 'A', label: 'Clean (Tested Scope)', color: 'text-emerald-400', border: 'border-emerald-500/30 bg-emerald-500/10' };
      }
      return { grade: 'N/A', label: normStatus || 'Idle', color: 'text-slate-400', border: 'border-slate-500/30 bg-slate-500/10' };
    }

    const penalty = counts.critical * 25 + counts.high * 12 + counts.medium * 4 + counts.low * 1;
    const partialSuffix = isPartialCoverage ? ' (Partial)' : '';

    if (penalty >= 50 || counts.critical > 0) {
      return { grade: 'F', label: `Critical Risk${partialSuffix}`, color: 'text-rose-400', border: 'border-rose-500/40 bg-rose-500/15' };
    }
    if (penalty >= 25 || counts.high > 0) {
      return { grade: 'D', label: `High Risk${partialSuffix}`, color: 'text-red-400', border: 'border-red-500/30 bg-red-500/10' };
    }
    if (penalty >= 10 || counts.medium > 0) {
      return { grade: 'C', label: `Moderate Risk${partialSuffix}`, color: 'text-amber-400', border: 'border-amber-500/30 bg-amber-500/10' };
    }
    return { grade: 'B', label: `Low Risk${partialSuffix}`, color: 'text-cyan-400', border: 'border-cyan-500/30 bg-cyan-500/10' };
  }, [counts, totalFindings, scanStatus, selectedTools, scannerStatus]);

  const severityItems = [
    { id: 'critical', label: 'Critical', count: counts.critical, dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]', text: 'text-rose-400', border: 'border-rose-500/30' },
    { id: 'high', label: 'High', count: counts.high, dot: 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]', text: 'text-red-400', border: 'border-red-500/30' },
    { id: 'medium', label: 'Med', count: counts.medium, dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]', text: 'text-amber-400', border: 'border-amber-500/30' },
    { id: 'low', label: 'Low', count: counts.low, dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    { id: 'info', label: 'Info', count: counts.info, dot: 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]', text: 'text-blue-400', border: 'border-blue-500/30' },
  ];

  const coverageTitle = coverage.rows
    .map(row => `${row.engine}: ${row.status}${row.reason ? ` — ${row.reason}` : ''}`)
    .join('\n');

  if (compact) {
    return (
      <div className="theme-card rounded-xl p-1 px-3 flex flex-wrap items-center justify-between gap-2 shadow-sm border border-[var(--border-card)] shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-mono ${securityPosture.border}`}>
            <span className={`font-bold ${securityPosture.color}`}>{securityPosture.grade}</span>
            <span className="text-[var(--text-muted)]">({totalFindings} Findings)</span>
          </div>
          <span
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-mono ${
              incompleteCoverage.length === 0
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
            title={coverageTitle}
          >
            <span className="uppercase tracking-wider text-[var(--text-muted)]">Coverage</span>
            <span className="font-bold tabular-nums">{coverage.tally.covered}/{coverage.rows.length}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {severityItems.map(item => {
            const isSelected = activeSeverityFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilterSeverity && onFilterSeverity(isSelected ? 'all' : item.id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono transition-all cursor-pointer ${item.border} ${
                  isSelected ? 'bg-white/10 ring-1 ring-[var(--accent-primary)] font-bold' : 'bg-black/20 hover:bg-white/5'
                }`}
                title={`Filter by ${item.label} severity`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                <span className="text-[var(--text-muted)] uppercase">{item.label}:</span>
                <span className={`font-bold tabular-nums ${item.text}`}>{item.count}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
          <Globe2 className="w-3 h-3 text-cyan-400" />
          <span>DAST: {wapitiVulns} vulns ({wapitiPages} crawled)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 space-y-1.5">
      <div className="theme-card rounded-xl p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-lg border border-[var(--border-card)]">
      {/* Left: Total Overview & Posture Grade */}
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--border-glow)]">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] leading-tight">Total Findings</div>
          <div className="text-base font-bold font-mono text-[var(--text-primary)] leading-tight tabular-nums">{totalFindings}</div>
        </div>

        {/* Posture Pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${securityPosture.border} transition-all`}>
          {securityPosture.grade === 'A' || securityPosture.grade === 'A+' ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : securityPosture.grade === 'F' ? (
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          ) : securityPosture.grade === 'N/A' ? (
            <Shield className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Posture:</span>
          <span className={`text-xs font-mono font-bold ${securityPosture.color}`}>{securityPosture.grade}</span>
          <span className={`text-[10px] font-medium hidden sm:inline ${securityPosture.color}`}>({securityPosture.label})</span>
        </div>
      </div>

      {/* Center: Interactive Severity Breakdown Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {severityItems.map(item => {
          const isSelected = activeSeverityFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterSeverity && onFilterSeverity(isSelected ? 'all' : item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${item.border} ${
                isSelected 
                  ? 'bg-white/10 ring-1 ring-[var(--accent-primary)] shadow-sm' 
                  : 'bg-black/30 hover:bg-white/5'
              }`}
              title={`Filter by ${item.label} severity`}
            >
              <span className={`w-2 h-2 rounded-full ${item.dot}`} />
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">{item.label}:</span>
              <span className={`text-xs font-mono font-bold tabular-nums ${item.text}`}>{item.count}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Coverage Matrix & DAST */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCoverageOpen(open => !open)}
          aria-expanded={coverageOpen}
          title={coverageTitle}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
            incompleteCoverage.length === 0
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">Coverage:</span>
          <span className="text-xs font-mono font-bold tabular-nums">{coverage.tally.covered}/{coverage.rows.length}</span>
          {coverageOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-card)]">
          <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">DAST:</span>
          <span className="text-xs font-mono font-bold text-[var(--text-primary)] tabular-nums">{wapitiVulns} vulns</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)] tabular-nums">({wapitiPages} crawled)</span>
        </div>
      </div>
      </div>

      {coverageOpen && (
        <div className="theme-card rounded-xl border border-[var(--border-card)] p-2.5 shadow-lg">
          <div className="flex flex-wrap items-center gap-1.5">
            {coverage.rows.map(row => {
              const meta = COVERAGE_META[row.bucket];
              return (
                <span
                  key={row.engine}
                  title={row.reason || row.status}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[10px] ${meta.badge}`}
                >
                  <span className="font-semibold">{row.engine}</span>
                  <span className="opacity-80">{meta.label}</span>
                </span>
              );
            })}
          </div>
          {incompleteCoverage.some(row => row.reason) && (
            <ul className="mt-2 space-y-0.5">
              {incompleteCoverage.filter(row => row.reason).map(row => (
                <li key={row.engine} className="text-[10px] font-mono text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-secondary)]">{row.engine}:</span> {row.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
