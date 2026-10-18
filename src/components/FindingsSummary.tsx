import { useMemo } from 'react';
import { Globe2, Activity, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Vulnerability } from '../types/vulnerability';

interface FindingsSummaryProps {
  nucleiFindings: { info: number; low: number; medium: number; high: number; critical: number };
  wapitiVulns: number;
  wapitiPages: number;
  allFindings?: Vulnerability[];
  activeSeverityFilter?: string;
  onFilterSeverity?: (sev: string) => void;
  compact?: boolean;
}

export default function FindingsSummary({
  nucleiFindings,
  wapitiVulns,
  wapitiPages,
  allFindings = [],
  activeSeverityFilter = 'all',
  onFilterSeverity,
  compact = false
}: FindingsSummaryProps) {
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

  // Calculate Weighted Risk Score (0 - 100 where 100 is cleanest/most secure)
  const securityPosture = useMemo(() => {
    if (totalFindings === 0) {
      return { grade: 'A+', label: 'Secure', color: 'text-emerald-400', border: 'border-emerald-500/30 bg-emerald-500/10' };
    }
    const penalty = counts.critical * 25 + counts.high * 12 + counts.medium * 4 + counts.low * 1;
    if (penalty >= 50 || counts.critical > 0) {
      return { grade: 'F', label: 'Critical Risk', color: 'text-rose-400', border: 'border-rose-500/40 bg-rose-500/15' };
    }
    if (penalty >= 25 || counts.high > 0) {
      return { grade: 'D', label: 'High Risk', color: 'text-red-400', border: 'border-red-500/30 bg-red-500/10' };
    }
    if (penalty >= 10 || counts.medium > 0) {
      return { grade: 'C', label: 'Moderate Risk', color: 'text-amber-400', border: 'border-amber-500/30 bg-amber-500/10' };
    }
    return { grade: 'B', label: 'Low Risk', color: 'text-cyan-400', border: 'border-cyan-500/30 bg-cyan-500/10' };
  }, [counts, totalFindings]);

  const severityItems = [
    { id: 'critical', label: 'Critical', count: counts.critical, dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]', text: 'text-rose-400', border: 'border-rose-500/30' },
    { id: 'high', label: 'High', count: counts.high, dot: 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]', text: 'text-red-400', border: 'border-red-500/30' },
    { id: 'medium', label: 'Med', count: counts.medium, dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]', text: 'text-amber-400', border: 'border-amber-500/30' },
    { id: 'low', label: 'Low', count: counts.low, dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    { id: 'info', label: 'Info', count: counts.info, dot: 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]', text: 'text-blue-400', border: 'border-blue-500/30' },
  ];

  if (compact) {
    return (
      <div className="theme-card rounded-xl p-1 px-3 flex flex-wrap items-center justify-between gap-2 shadow-sm border border-[var(--border-card)] shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-mono ${securityPosture.border}`}>
            <span className={`font-bold ${securityPosture.color}`}>{securityPosture.grade}</span>
            <span className="text-[var(--text-muted)]">({totalFindings} Findings)</span>
          </div>
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
    <div className="theme-card rounded-xl p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-lg border border-[var(--border-card)] shrink-0">
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
          {securityPosture.grade === 'A+' ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : securityPosture.grade === 'F' ? (
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
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

      {/* Right: DAST Coverage */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-card)]">
          <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">DAST:</span>
          <span className="text-xs font-mono font-bold text-[var(--text-primary)] tabular-nums">{wapitiVulns} vulns</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)] tabular-nums">({wapitiPages} crawled)</span>
        </div>
      </div>
    </div>
  );
}
