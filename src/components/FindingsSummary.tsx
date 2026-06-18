interface FindingsSummaryProps {
  nucleiFindings: { info: number; low: number; medium: number; high: number; critical: number };
  wapitiVulns: number;
  wapitiPages: number;
}

export default function FindingsSummary({ nucleiFindings, wapitiVulns, wapitiPages }: FindingsSummaryProps) {
  return (
    <div className="h-32 bg-slate-800 rounded-xl border border-slate-700 shadow-sm p-4 flex">
      <div className="flex-1 border-r border-slate-700 pr-4">
        <h3 className="text-sm font-semibold text-slate-400 mb-2">NUCLEI FINDINGS</h3>
        <div className="flex space-x-4">
          <div className="text-center"><div className="text-2xl font-bold text-rose-500">{nucleiFindings.critical}</div><div className="text-xs text-slate-500">CRITICAL</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-red-500">{nucleiFindings.high}</div><div className="text-xs text-slate-500">HIGH</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-amber-500">{nucleiFindings.medium}</div><div className="text-xs text-slate-500">MEDIUM</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-emerald-500">{nucleiFindings.low}</div><div className="text-xs text-slate-500">LOW</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-blue-500">{nucleiFindings.info}</div><div className="text-xs text-slate-500">INFO</div></div>
        </div>
      </div>
      <div className="flex-1 pl-4">
        <h3 className="text-sm font-semibold text-slate-400 mb-2">WAPITI FINDINGS</h3>
        <div className="flex space-x-4">
          <div className="text-center"><div className="text-2xl font-bold text-slate-200">{wapitiVulns}</div><div className="text-xs text-slate-500">VULNS</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-slate-400">{wapitiPages}</div><div className="text-xs text-slate-500">PAGES</div></div>
        </div>
      </div>
    </div>
  );
}
