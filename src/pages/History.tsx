import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History as HistoryIcon, Search, FolderOpen, ShieldCheck, Play, Download, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useScanStore } from '../stores/useScanStore';
import { ExportReportModal } from '../components/ExportReportModal';

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
  const [exportModalScan, setExportModalScan] = useState<HistoryScan | null>(null);
  const [showConfirmClearAll, setShowConfirmClearAll] = useState(false);
  const [confirmDeleteScan, setConfirmDeleteScan] = useState<HistoryScan | null>(null);
  const navigate = useNavigate();
  const { setTargetUrl } = useScanStore();

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

  const handleDeleteScan = async (scan: HistoryScan) => {
    if (window.api) {
      await window.api.deleteScan(scan.scanId);
      setHistory(prev => prev.filter(s => s.scanId !== scan.scanId));
      setConfirmDeleteScan(null);
    }
  };

  const handleClearAll = async () => {
    if (window.api) {
      await window.api.clearAllScans();
      setHistory([]);
      setShowConfirmClearAll(false);
    }
  };

  const handleReScan = (target: string) => {
    setTargetUrl(target);
    navigate('/');
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

        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <button
              onClick={() => setShowConfirmClearAll(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 rounded-xl transition-all cursor-pointer shadow-sm"
              title="Delete all scan results and generated artifacts"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Results</span>
            </button>
          )}

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
      </div>

      <div className="theme-card rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[var(--bg-surface)] text-[var(--text-muted)] font-mono uppercase tracking-wider border-b border-[var(--border-card)] sticky top-0">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Target & Domain</th>
                <th className="px-6 py-3.5 font-semibold">Timestamp</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
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
                      {scan.startTime ? format(new Date(scan.startTime), 'MMM d, yyyy HH:mm:ss') : '-'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${getStatusBadge(scan.status)}`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleReScan(scan.target)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 rounded-lg transition-all cursor-pointer"
                          title="Re-scan this target on Dashboard"
                        >
                          <Play className="w-3 h-3 fill-emerald-400" />
                          <span>Re-Scan</span>
                        </button>

                        <button
                          onClick={() => setExportModalScan(scan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 border border-[var(--border-glow)] rounded-lg transition-all cursor-pointer"
                          title="Export Report"
                        >
                          <Download className="w-3 h-3" />
                          <span>Report</span>
                        </button>

                        <button 
                          onClick={() => handleOpenFolder(scan.scanId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 border border-[var(--border-card)] rounded-lg transition-all cursor-pointer"
                          title="Open Report Folder"
                        >
                          <FolderOpen className="w-3 h-3 text-[var(--text-muted)]" />
                          <span>Folder</span>
                        </button>

                        <button 
                          onClick={() => setConfirmDeleteScan(scan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-400/80 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-all cursor-pointer"
                          title="Delete this scan"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Report Modal */}
      {exportModalScan && (
        <ExportReportModal
          isOpen={!!exportModalScan}
          onClose={() => setExportModalScan(null)}
          scanId={exportModalScan.scanId}
          targetUrl={exportModalScan.target}
        />
      )}

      {/* Confirm Delete Single Scan Modal */}
      {confirmDeleteScan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="theme-card border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Delete Assessment Scan?</h3>
                <p className="text-xs text-red-400/80">Permanent deletion</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to delete scan record <strong>{confirmDeleteScan.scanId}</strong> for target <strong className="text-[var(--text-primary)]">{confirmDeleteScan.target}</strong>? All associated findings and artifact files will be removed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteScan(null)}
                className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 border border-[var(--border-card)] rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteScan(confirmDeleteScan)}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-600/30 cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Scan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear All Scans Modal */}
      {showConfirmClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="theme-card border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Clear All Assessment History?</h3>
                <p className="text-xs text-red-400/80">Destructive bulk operation</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to delete all <strong>{history.length}</strong> scan records? This will permanently remove all findings, observation fingerprints, and generated report folders from your local disk.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmClearAll(false)}
                className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 border border-[var(--border-card)] rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-600/30 cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear All Scans</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
