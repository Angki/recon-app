import { useEffect, useState } from 'react';
import { History as HistoryIcon, Search, FolderOpen } from 'lucide-react';
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
        return 'bg-emerald-500/10 text-emerald-400';
      case 'FAILED':
        return 'bg-red-500/10 text-red-400';
      case 'STOPPED':
        return 'bg-slate-500/10 text-slate-400';
      case 'RUNNING':
        return 'bg-amber-500/10 text-amber-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <HistoryIcon className="w-6 h-6 text-blue-500" />
          Scan History
        </h1>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search history..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-64"
          />
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700 sticky top-0">
            <tr>
              <th className="px-6 py-4 font-semibold">Target</th>
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  {history.length === 0 ? 'No scan history found' : 'No results match your search'}
                </td>
              </tr>
            ) : (
              filtered.map((scan) => (
                <tr key={scan.scanId} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-200">{scan.target}</div>
                    <div className="text-xs text-slate-500">{scan.scanId}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {format(new Date(scan.startTime), 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(scan.status)}`}>
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => handleOpenFolder(scan.scanId)}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        title="Open Report Folder"
                      >
                        <FolderOpen className="w-4 h-4" />
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
  );
}
