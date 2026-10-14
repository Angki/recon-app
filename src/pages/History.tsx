import { useEffect, useState } from 'react';
import { History as HistoryIcon, Search, FolderOpen, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

type HistoryScan = {
  scanId: string;
  target: string;
  domain?: string;
  status: string;
  startTime: string;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryScan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchHistory = async () => {
      if (window.api) {
        const hist = await window.api.getHistory() as HistoryScan[];
        if (mounted) setHistory(hist);
      }
    };
    fetchHistory();
    return () => { mounted = false; };
  }, []);

  const handleOpenFolder = (scanId: string) => {
    if (window.api) {
      window.api.openReportFolder(scanId);
    }
  };

  const filtered = history.filter((scan) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      scan.target?.toLowerCase().includes(term) ||
      scan.domain?.toLowerCase().includes(term) ||
      scan.scanId?.toLowerCase().includes(term) ||
      scan.status?.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      case 'FAILED':
        return 'bg-red-500/10 text-red-400 border border-red-500/30';
      case 'STOPPED':
        return 'bg-black/20 text-[var(--text-muted)] border border-[var(--border-card)]';
      case 'RUNNING':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse';
      default:
        return 'bg-black/20 text-[var(--text-muted)] border border-[var(--border-card)]';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--border-glow)]">
            <HistoryIcon className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Assessment History
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">Historical audit logs, targets, and generated report artifacts.</p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search scans by URL or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl pl-10 pr-4 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] w-72 placeholder-[var(--text-muted)] transition-all shadow-inner"
          />
        </div>
      </div>

      <div className="theme-card rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[var(--bg-surface)] text-[var(--text-muted)] font-mono uppercase tracking-wider border-b border-[var(--border-card)] sticky top-0">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Target & Domain</th>
                <th className="px-6 py-3.5 font-semibold">Timestamp</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 font-semibold text-right">Reports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-card)]/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--text-muted)]" />
                    <p className="font-medium">{history.length === 0 ? 'No scan history recorded yet' : 'No scans match your search query'}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((scan) => (
                  <tr key={scan.scanId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-[var(--text-primary)] text-sm">{scan.target}</div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)]">{scan.scanId}</div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[var(--text-secondary)]">
                      {format(new Date(scan.startTime), 'MMM d, yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${getStatusBadge(scan.status)}`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button 
                        onClick={() => handleOpenFolder(scan.scanId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 border border-[var(--border-card)] hover:border-[var(--border-glow)] rounded-xl transition-all cursor-pointer"
                        title="Open Report Folder"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>Open Folder</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
