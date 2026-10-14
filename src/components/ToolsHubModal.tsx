import React, { useState, useEffect, useRef } from 'react';
import { 
  X, RefreshCw, Download, CheckCircle2, AlertTriangle, 
  XCircle, Terminal, Shield, Zap, Search, Globe, ShieldAlert, Cpu, Sparkles
} from 'lucide-react';
import type { ToolHealthInfo } from '../types/global';

interface ToolsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ToolsHubModal: React.FC<ToolsHubModalProps> = ({ isOpen, onClose }) => {
  const [tools, setTools] = useState<ToolHealthInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingTool, setUpdatingTool] = useState<string | null>(null);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchHealth = async () => {
    if (!window.api?.getToolsHealth) return;
    setLoading(true);
    try {
      const data = await window.api.getToolsHealth();
      setTools(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `[-] Error loading health matrix: ${msg}`]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  // IPC listener for update progress
  useEffect(() => {
    if (!window.api?.onToolUpdateProgress) return;

    const removeProgressListener = window.api.onToolUpdateProgress((_event, data) => {
      setLogs((prev) => [...prev, data.message]);
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    });

    const removeStatusListener = window.api.onToolUpdateStatus?.((_event, status) => {
      if (status === 'DONE') {
        setIsUpdatingAll(false);
        setUpdatingTool(null);
        fetchHealth();
      }
    });

    return () => {
      removeProgressListener();
      removeStatusListener?.();
    };
  }, []);

  const handleUpdateSingle = async (toolName: string) => {
    if (updatingTool || isUpdatingAll) return;
    setUpdatingTool(toolName);
    setLogs((prev) => [...prev, `\n[*] Initiating update for ${toolName}...`]);
    try {
      await window.api.updateTool(toolName);
      await fetchHealth();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `[-] Update failed for ${toolName}: ${msg}`]);
    } finally {
      setUpdatingTool(null);
    }
  };

  const handleUpdateAll = async () => {
    if (isUpdatingAll || updatingTool) return;
    setIsUpdatingAll(true);
    setLogs((prev) => [...prev, `\n[*] Starting Master Suite Update...`]);
    try {
      await window.api.updateAllTools();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `[-] Master update encountered error: ${msg}`]);
      setIsUpdatingAll(false);
    }
  };

  const filteredTools = tools.filter((t) => {
    const matchesCat = filterCategory === 'all' || t.category === filterCategory;
    const matchesSearch = 
      t.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const readyCount = tools.filter((t) => t.installed).length;
  const updateCount = tools.filter((t) => t.updateAvailable).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[90vh] bg-[var(--bg-surface)] border border-[var(--border-card)] rounded-2xl shadow-2xl flex flex-col overflow-hidden theme-card">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-card)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--border-glow)]">
              <Cpu className="w-6 h-6 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                Engines & Security Tool Suite
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Manage, update, and auto-download ProjectDiscovery tools, Nuclei templates, and Wapiti.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchHealth}
              disabled={loading || isUpdatingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-[var(--border-glow)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
              title="Refresh version matrix"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleUpdateAll}
              disabled={isUpdatingAll || !!updatingTool}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] shadow-md shadow-[var(--accent-glow)] transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isUpdatingAll ? 'animate-spin' : ''}`} />
              <span>{isUpdatingAll ? 'Updating All...' : 'Update All Engines & Templates'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Telemetry Bar */}
        <div className="grid grid-cols-3 gap-4 px-6 py-3 border-b border-[var(--border-card)] bg-black/10 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-[var(--text-muted)]">Installed & Ready:</span>
            <span className="font-mono font-bold text-[var(--text-primary)]">{readyCount} / {tools.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[var(--text-muted)]">Updates Available:</span>
            <span className="font-mono font-bold text-amber-400">{updateCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-[var(--text-muted)]">Template Status:</span>
            <span className="font-mono font-bold text-emerald-400">Nuclei Auto-Sync</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-[var(--border-card)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-1.5">
            {['all', 'dast', 'recon', 'fuzz', 'network'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium uppercase tracking-wider transition-all cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[var(--bg-card)] rounded-xl px-3 py-1 border border-[var(--border-card)] focus-within:border-[var(--accent-primary)] transition-all">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] mr-2" />
            <input
              type="text"
              placeholder="Filter tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-xs text-[var(--text-primary)] outline-none w-40 placeholder-[var(--text-muted)]"
            />
          </div>
        </div>

        {/* Tools Matrix Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-card)] text-[var(--text-muted)] font-mono uppercase tracking-wider">
                <th className="py-2.5 px-3">Tool Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Installed Version</th>
                <th className="py-2.5 px-3">Latest Release</th>
                <th className="py-2.5 px-3">Path / Location</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-card)]/50">
              {filteredTools.map((t) => {
                const isThisUpdating = updatingTool === t.name || isUpdatingAll;
                return (
                  <tr key={t.name} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-2">
                        {t.category === 'dast' ? (
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                        ) : t.category === 'recon' ? (
                          <Globe className="w-4 h-4 text-cyan-400" />
                        ) : t.category === 'fuzz' ? (
                          <Zap className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Terminal className="w-4 h-4 text-emerald-400" />
                        )}
                        <span>{t.displayName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-medium bg-black/20 border border-[var(--border-card)] text-[var(--text-secondary)]">
                        {t.category}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      {t.installed ? (
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t.currentVersion}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-rose-400">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Not Installed</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <span className={t.updateAvailable ? 'text-amber-400 font-bold' : 'text-[var(--text-secondary)]'}>
                        {t.latestVersion}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-muted)] max-w-xs truncate" title={t.resolvedPath}>
                      {t.resolvedPath}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {t.requiresManual ? (
                        <span className="text-[11px] text-[var(--text-muted)] italic">Manual Install</span>
                      ) : (
                        <button
                          onClick={() => handleUpdateSingle(t.name)}
                          disabled={isThisUpdating}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50 ${
                            t.updateAvailable
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-card)] hover:border-[var(--border-glow)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Download className={`w-3 h-3 ${isThisUpdating ? 'animate-bounce' : ''}`} />
                          <span>{isThisUpdating ? 'Updating...' : t.updateAvailable ? 'Update' : t.installed ? 'Reinstall' : 'Install'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Live Output Log Console */}
        {logs.length > 0 && (
          <div className="border-t border-[var(--border-card)] bg-[var(--term-bg)] flex flex-col h-44 shrink-0">
            <div className="flex items-center justify-between px-4 py-1.5 bg-black/30 border-b border-[var(--border-card)] text-[11px] font-mono text-[var(--text-muted)]">
              <span className="flex items-center gap-2 text-emerald-400 font-bold">
                <Terminal className="w-3.5 h-3.5" />
                <span>ENGINE CONSOLE OUTPUT</span>
              </span>
              <button
                onClick={() => setLogs([])}
                className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Clear Output
              </button>
            </div>
            <div
              ref={logContainerRef}
              className="flex-1 p-3 font-mono text-[11px] text-[var(--term-fg)] overflow-y-auto whitespace-pre-wrap leading-relaxed select-text"
            >
              {logs.join('\n')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
