import { ShieldAlert, Globe2, Activity } from 'lucide-react';

interface FindingsSummaryProps {
  nucleiFindings: { info: number; low: number; medium: number; high: number; critical: number };
  wapitiVulns: number;
  wapitiPages: number;
}

export default function FindingsSummary({ nucleiFindings, wapitiVulns, wapitiPages }: FindingsSummaryProps) {
  const totalFindings = 
    nucleiFindings.critical + nucleiFindings.high + nucleiFindings.medium + 
    nucleiFindings.low + nucleiFindings.info + wapitiVulns;

  return (
    <div className="theme-card rounded-2xl p-4 flex flex-col md:flex-row items-center gap-6 shadow-md">
      {/* Total Overview */}
      <div className="flex items-center gap-3.5 pr-6 border-b md:border-b-0 md:border-r border-[var(--border-card)] shrink-0 w-full md:w-auto">
        <div className="p-2.5 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--border-glow)]">
          <Activity className="w-5 h-5 text-[var(--accent-primary)]" />
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Total Findings</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{totalFindings}</div>
        </div>
      </div>

      {/* Nuclei Breakdown */}
      <div className="flex-1 w-full">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold font-mono uppercase tracking-wider text-[var(--text-secondary)]">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Nuclei Telemetry</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div className="p-2 rounded-xl bg-black/20 border border-rose-500/20 text-center">
            <div className="text-xl font-bold font-mono text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">{nucleiFindings.critical}</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Critical</div>
          </div>
          <div className="p-2 rounded-xl bg-black/20 border border-red-500/20 text-center">
            <div className="text-xl font-bold font-mono text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">{nucleiFindings.high}</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">High</div>
          </div>
          <div className="p-2 rounded-xl bg-black/20 border border-amber-500/20 text-center">
            <div className="text-xl font-bold font-mono text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]">{nucleiFindings.medium}</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Medium</div>
          </div>
          <div className="p-2 rounded-xl bg-black/20 border border-emerald-500/20 text-center">
            <div className="text-xl font-bold font-mono text-emerald-400">{nucleiFindings.low}</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Low</div>
          </div>
          <div className="p-2 rounded-xl bg-black/20 border border-blue-500/20 text-center">
            <div className="text-xl font-bold font-mono text-blue-400">{nucleiFindings.info}</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Info</div>
          </div>
        </div>
      </div>

      {/* Wapiti Breakdown */}
      <div className="shrink-0 border-t md:border-t-0 md:border-l border-[var(--border-card)] pl-0 md:pl-6 w-full md:w-auto">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold font-mono uppercase tracking-wider text-[var(--text-secondary)]">
          <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Wapiti DAST</span>
        </div>
        <div className="flex gap-2">
          <div className="p-2 px-4 rounded-xl bg-black/20 border border-[var(--border-card)] text-center">
            <div className="text-xl font-bold font-mono text-[var(--text-primary)]">{wapitiVulns}</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Vulns</div>
          </div>
          <div className="p-2 px-4 rounded-xl bg-black/20 border border-[var(--border-card)] text-center">
            <div className="text-xl font-bold font-mono text-[var(--text-secondary)]">{wapitiPages}</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Crawled</div>
          </div>
        </div>
      </div>
    </div>
  );
}
