import { useState, useEffect, useRef } from 'react';
import { 
  Play, Square, FolderOpen, Copy, Sparkles, Globe, ShieldAlert, 
  Download, History, ChevronDown, Check, RotateCcw, SlidersHorizontal,
  Layout, Layers, Radio, BarChart3, X
} from 'lucide-react';
import type { DashboardViewSettings } from '../stores/useScanStore';

interface ScannerControlsProps {
  targetUrl: string;
  setTargetUrl: (val: string) => void;
  status: string;
  scanId: string | null;
  isWordpressScan: boolean;
  setIsWordpressScan: (val: boolean) => void;
  handleStartScan: () => void;
  handleStopScan: () => void;
  handleOpenFolder: () => void;
  handleAnalyzeAI: () => void;
  handleCopyLogsForAI: () => void;
  handleUpdateTools: () => void;
  handleClearLiveView?: () => void;
  onOpenExportReport?: () => void;
  isAnalyzing: boolean;
  isUpdating: boolean;
  dashboardView?: DashboardViewSettings;
  setDashboardView?: (updater: Partial<DashboardViewSettings> | ((prev: DashboardViewSettings) => DashboardViewSettings)) => void;
  executionMode?: 'pipeline' | 'concurrent';
  setExecutionMode?: (mode: 'pipeline' | 'concurrent') => void;
}

const DEFAULT_TARGET_PRESETS = [
  'https://palukota.go.id',
  'http://testphp.vulnweb.com',
  'http://scanme.nmap.org',
  'https://juice-shop.herokuapp.com'
];

export default function ScannerControls({
  targetUrl, setTargetUrl, status, scanId,
  isWordpressScan, setIsWordpressScan,
  handleStartScan, handleStopScan,
  handleOpenFolder, handleAnalyzeAI, handleCopyLogsForAI, handleUpdateTools,
  handleClearLiveView,
  onOpenExportReport,
  isAnalyzing, isUpdating,
  dashboardView, setDashboardView,
  executionMode = 'pipeline', setExecutionMode
}: ScannerControlsProps) {
  const isRunning = ['STARTING', 'RUNNING', 'STOPPING'].includes(status);
  const [showHistory, setShowHistory] = useState(false);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [recentTargets, setRecentTargets] = useState<string[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Load target history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('secops_recent_targets');
      if (stored) {
        setRecentTargets(JSON.parse(stored));
      } else {
        setRecentTargets(DEFAULT_TARGET_PRESETS);
      }
    } catch {
      setRecentTargets(DEFAULT_TARGET_PRESETS);
    }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowViewSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveTargetToHistory = (url: string) => {
    if (!url || url.trim().length < 3) return;
    const clean = url.trim();
    setRecentTargets(prev => {
      const updated = [clean, ...prev.filter(t => t.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem('secops_recent_targets', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const onStart = () => {
    saveTargetToHistory(targetUrl);
    handleStartScan();
  };

  const applyViewMode = (mode: 'focus' | 'standard' | 'full') => {
    if (!setDashboardView) return;
    if (mode === 'focus') {
      setDashboardView({
        mode: 'focus',
        showToolSelection: false,
        showTelemetry: false,
        showSummaryCards: false
      });
    } else if (mode === 'standard') {
      setDashboardView({
        mode: 'standard',
        showToolSelection: false,
        showTelemetry: true,
        showSummaryCards: true
      });
    } else {
      setDashboardView({
        mode: 'full',
        showToolSelection: true,
        showTelemetry: true,
        showSummaryCards: true
      });
    }
  };

  return (
    <div className="theme-card relative z-30 p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-lg border border-[var(--border-card)]">
      {/* LEVEL 1 (TOP): Target URL Input Box (Full Width, Highest Visibility) */}
      <div className="flex items-center gap-2.5 w-full relative z-40" ref={historyRef}>
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--accent-primary)] pointer-events-none flex items-center gap-1.5">
            <Globe className="w-4 h-4" />
            <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold hidden sm:inline">TARGET:</span>
          </div>
          
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Target URL / Domain (e.g., palukota.go.id or https://target.com)"
            className="w-full bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl pl-9 sm:pl-20 pr-16 py-2.5 text-xs text-[var(--text-primary)] font-mono font-medium focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all placeholder:[var(--text-muted)] shadow-inner"
            disabled={isRunning}
            onFocus={() => setShowHistory(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!isRunning) onStart();
              }
            }}
          />

          {/* Quick Clear Target Button */}
          {targetUrl && !isRunning && (
            <button
              type="button"
              onClick={() => setTargetUrl('')}
              className="absolute right-9 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 cursor-pointer"
              title="Clear Target Input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* History Dropdown Toggle */}
          <button
            type="button"
            onClick={() => setShowHistory(prev => !prev)}
            disabled={isRunning}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 cursor-pointer"
            title="Recent Targets & Lab Presets"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showHistory ? 'rotate-180 text-[var(--accent-primary)]' : ''}`} />
          </button>

          {/* Recent Targets Dropdown Menu */}
          {showHistory && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--bg-surface)] border border-[var(--border-glow)] rounded-xl shadow-2xl shadow-black/80 z-50 overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="p-2 border-b border-[var(--border-card)] bg-[var(--bg-card)] flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  Recent Targets & Test Labs
                </span>
                <span className="text-[10px] font-mono">1-Click Select</span>
              </div>
              <div className="max-h-52 overflow-y-auto p-1 font-mono text-xs space-y-0.5 scrollbar-thin">
                {recentTargets.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTargetUrl(item);
                      setShowHistory(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--accent-primary)]/15 hover:text-[var(--accent-primary)] text-[var(--text-secondary)] transition-all flex items-center justify-between cursor-pointer group"
                  >
                    <span className="truncate">{item}</span>
                    {targetUrl === item && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* WordPress Mode Toggle */}
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-[var(--border-glow)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shrink-0 select-none shadow-sm">
          <input
            type="checkbox"
            checked={isWordpressScan}
            onChange={(e) => setIsWordpressScan(e.target.checked)}
            disabled={isRunning}
            className="w-3.5 h-3.5 rounded bg-[var(--bg-app)] border-[var(--border-card)] text-[var(--accent-primary)] focus:ring-0 cursor-pointer"
          />
          <span className="font-semibold text-[11px]">WordPress</span>
        </label>
      </div>

      {/* LEVEL 2 (BOTTOM): Action Buttons Toolbar & Display Settings */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5 border-t border-[var(--border-card)]/50">
        {/* Left Side: Primary Execution Button */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={onStart}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-900/40 hover:scale-[1.02] cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>START SCAN</span>
            </button>
          ) : (
            <button
              onClick={handleStopScan}
              disabled={status !== 'RUNNING' || !scanId}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-rose-900/40 hover:scale-[1.02] cursor-pointer animate-pulse"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>STOP SCAN</span>
            </button>
          )}

          {/* Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-app)] border border-[var(--border-card)] text-[10px] font-mono text-[var(--text-muted)]">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : status === 'COMPLETED' ? 'bg-cyan-400' : 'bg-slate-500'}`} />
            <span className="uppercase font-semibold tracking-wider">{status}</span>
          </div>

          {/* Execution Mode Segmented Control */}
          <div className="flex items-center rounded-xl bg-[var(--bg-app)] border border-[var(--border-card)] p-0.5 text-[10px] font-mono shrink-0">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setExecutionMode && setExecutionMode('pipeline')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold ${
                executionMode === 'pipeline'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
              title="Mode Bertahap (Pipeline): Menjalankan scanner teratur per fase (Recon -> Crawl -> Param -> DAST). Menghemat CPU/memori dan mencegah blokir WAF/rate-limit target."
            >
              <span>🔄 Bertahap</span>
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setExecutionMode && setExecutionMode('concurrent')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold ${
                executionMode === 'concurrent'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
              title="Mode Serentak (Parallel): Menjalankan semua scanner terpilih bersamaan. Rangkaian discovery (subfinder → dnsx → httpx) tetap berurutan agar host hasil temuan diteruskan ke engine berikutnya."
            >
              <span>⚡ Serentak</span>
            </button>
          </div>
        </div>

        {/* Right Side: Secondary Actions & Layout Settings */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Export Report */}
          <button
            onClick={onOpenExportReport}
            disabled={!scanId}
            title="Export Multi-Format Security Report (SARIF, HTML, JSON, Markdown)"
            className="flex items-center gap-1.5 bg-[var(--bg-card)] hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] hover:border-[var(--border-glow)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-secondary)] border border-[var(--border-card)] px-3 py-1.5 rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="hidden md:inline">Export Report</span>
          </button>

          {/* Artifacts Folder */}
          <button
            onClick={handleOpenFolder}
            disabled={!scanId}
            className="flex items-center gap-1.5 bg-[var(--bg-card)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-card)] px-2.5 py-1.5 rounded-xl font-medium text-xs transition-all cursor-pointer"
            title="Open Report Folder in Explorer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">Artifacts</span>
          </button>

          {/* AI Security Analyst */}
          <button
            onClick={handleAnalyzeAI}
            disabled={!scanId || isAnalyzing}
            title="Analyze console logs with AI Security Analyst"
            className="flex items-center gap-1.5 bg-purple-600/90 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-xl font-semibold text-xs transition-all shadow-sm shadow-purple-900/20 cursor-pointer"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Analyzing...' : 'AI Analyst'}</span>
          </button>

          {/* Copy Logs */}
          <button
            onClick={handleCopyLogsForAI}
            disabled={!scanId}
            title="Copy raw scan logs formatted for LLM context"
            className="flex items-center gap-1.5 bg-[var(--bg-card)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-card)] px-2.5 py-1.5 rounded-xl font-medium text-xs transition-all cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Copy Logs</span>
          </button>

          {/* Clear View */}
          {scanId && !isRunning && handleClearLiveView && (
            <button
              onClick={handleClearLiveView}
              title="Clear live scan results from dashboard view"
              className="flex items-center gap-1.5 bg-[var(--bg-card)] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-[var(--text-secondary)] border border-[var(--border-card)] px-2.5 py-1.5 rounded-xl font-medium text-xs transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden xl:inline">Clear</span>
            </button>
          )}

          {/* Tools Hub */}
          <button
            onClick={handleUpdateTools}
            disabled={isUpdating}
            className="flex items-center gap-1.5 bg-[var(--bg-card)] hover:border-[var(--border-glow)] text-[var(--text-primary)] border border-[var(--border-card)] px-3 py-1.5 rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Tools Hub</span>
          </button>

          {/* DISPLAY / VIEW SETTINGS DROPDOWN (Pilihan Setting Tampilan UI) */}
          {dashboardView && setDashboardView && (
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setShowViewSettings(prev => !prev)}
                title="Tampilan UI & Layout Settings (Sesuaikan ukuran hasil scan)"
                className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-sm ${
                  dashboardView.mode === 'focus'
                    ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-card)] hover:border-[var(--border-glow)] hover:text-[var(--text-primary)]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Tampilan</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showViewSettings ? 'rotate-180' : ''}`} />
              </button>

              {/* View Settings Popover */}
              {showViewSettings && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--bg-surface)] border border-[var(--border-glow)] rounded-2xl shadow-2xl shadow-black/90 z-50 p-3 backdrop-blur-2xl animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="pb-2 mb-2 border-b border-[var(--border-card)] flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Layout className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      Setting Layout UI
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">Mode Tampilan</span>
                  </div>

                  {/* Mode Presets */}
                  <div className="space-y-1 mb-3">
                    <button
                      type="button"
                      onClick={() => applyViewMode('focus')}
                      className={`w-full text-left p-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer border ${
                        dashboardView.mode === 'focus'
                          ? 'bg-[var(--accent-primary)]/15 border-[var(--border-glow)] text-[var(--accent-primary)] font-bold'
                          : 'bg-[var(--bg-card)] border-transparent text-[var(--text-secondary)] hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>🎯 Fokus Hasil Scan</span>
                          <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.2 rounded font-mono">Max Room</span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Maksimalkan ruang tabel temuan, sembunyikan tool suite</div>
                      </div>
                      {dashboardView.mode === 'focus' && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-1" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => applyViewMode('standard')}
                      className={`w-full text-left p-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer border ${
                        dashboardView.mode === 'standard'
                          ? 'bg-[var(--accent-primary)]/15 border-[var(--border-glow)] text-[var(--accent-primary)] font-bold'
                          : 'bg-[var(--bg-card)] border-transparent text-[var(--text-secondary)] hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>⚡ Standar (Seimbang)</span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Telemetry HUD + Hasil temuan aktif</div>
                      </div>
                      {dashboardView.mode === 'standard' && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-1" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => applyViewMode('full')}
                      className={`w-full text-left p-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer border ${
                        dashboardView.mode === 'full'
                          ? 'bg-[var(--accent-primary)]/15 border-[var(--border-glow)] text-[var(--accent-primary)] font-bold'
                          : 'bg-[var(--bg-card)] border-transparent text-[var(--text-secondary)] hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>🛰️ Full Ops (Lengkap)</span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Tampilkan semua 26 tool, HUD, dan kartu statistik</div>
                      </div>
                      {dashboardView.mode === 'full' && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-1" />}
                    </button>
                  </div>

                  {/* Individual Panel Visibility Toggles */}
                  <div className="pt-2 border-t border-[var(--border-card)] space-y-1.5 text-xs">
                    <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider px-1">
                      Kustomisasi Panel:
                    </div>

                    <label className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] cursor-pointer hover:bg-white/5 transition-colors">
                      <span className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[11px]">
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        Panel Pilihan Tools
                      </span>
                      <input
                        type="checkbox"
                        checked={dashboardView.showToolSelection}
                        onChange={(e) => setDashboardView({ showToolSelection: e.target.checked, mode: 'custom' as any })}
                        className="rounded bg-[var(--bg-app)] border-[var(--border-card)] text-[var(--accent-primary)] focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] cursor-pointer hover:bg-white/5 transition-colors">
                      <span className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[11px]">
                        <Radio className="w-3.5 h-3.5 text-emerald-400" />
                        Pipeline Telemetry HUD
                      </span>
                      <input
                        type="checkbox"
                        checked={dashboardView.showTelemetry}
                        onChange={(e) => setDashboardView({ showTelemetry: e.target.checked, mode: 'custom' as any })}
                        className="rounded bg-[var(--bg-app)] border-[var(--border-card)] text-[var(--accent-primary)] focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] cursor-pointer hover:bg-white/5 transition-colors">
                      <span className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[11px]">
                        <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                        Kartu Statistik Ringkasan
                      </span>
                      <input
                        type="checkbox"
                        checked={dashboardView.showSummaryCards}
                        onChange={(e) => setDashboardView({ showSummaryCards: e.target.checked, mode: 'custom' as any })}
                        className="rounded bg-[var(--bg-app)] border-[var(--border-card)] text-[var(--accent-primary)] focus:ring-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
