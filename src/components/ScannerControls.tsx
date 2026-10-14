import { Play, Square, FolderOpen, Copy, Sparkles, Globe, ShieldAlert } from 'lucide-react';

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
  isAnalyzing: boolean;
  isUpdating: boolean;
}

export default function ScannerControls({
  targetUrl, setTargetUrl, status, scanId,
  isWordpressScan, setIsWordpressScan,
  handleStartScan, handleStopScan,
  handleOpenFolder, handleAnalyzeAI, handleCopyLogsForAI, handleUpdateTools,
  isAnalyzing, isUpdating
}: ScannerControlsProps) {
  const isRunning = status === 'RUNNING';

  return (
    <div className="theme-card p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
      {/* Target Input with Smart Protocol and WordPress toggle */}
      <div className="flex items-center gap-3 flex-1 w-full max-w-2xl">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--accent-primary)] pointer-events-none">
            <Globe className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Target URL / Domain (e.g., example.com or https://target.com)"
            className="w-full bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all placeholder:[var(--text-muted)] shadow-inner"
            disabled={isRunning}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!isRunning) handleStartScan();
              }
            }}
          />
        </div>

        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shrink-0 select-none">
          <input
            type="checkbox"
            checked={isWordpressScan}
            onChange={(e) => setIsWordpressScan(e.target.checked)}
            disabled={isRunning}
            className="w-3.5 h-3.5 rounded bg-[var(--bg-app)] border-[var(--border-card)] text-[var(--accent-primary)] focus:ring-0 cursor-pointer"
          />
          <span className="font-medium">WordPress Mode</span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5 flex-wrap justify-end">
        {!isRunning ? (
          <button
            onClick={handleStartScan}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-900/30 hover:scale-[1.02] cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>START SCAN</span>
          </button>
        ) : (
          <button
            onClick={handleStopScan}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-rose-900/30 hover:scale-[1.02] cursor-pointer animate-pulse"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>STOP SCAN</span>
          </button>
        )}

        <button
          onClick={handleOpenFolder}
          disabled={!scanId}
          className="flex items-center gap-1.5 bg-[var(--bg-card)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-card)] px-3.5 py-2 rounded-xl font-medium text-xs transition-all cursor-pointer"
          title="Open Report Folder in Explorer"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Artifacts</span>
        </button>

        <button
          onClick={handleAnalyzeAI}
          disabled={!scanId || isAnalyzing}
          title="Analyze console logs with AI"
          className="flex items-center gap-1.5 bg-purple-600/90 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3.5 py-2 rounded-xl font-medium text-xs transition-all shadow-sm shadow-purple-900/20 cursor-pointer"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isAnalyzing ? 'Analyzing...' : 'AI Analysis'}</span>
        </button>

        <button
          onClick={handleCopyLogsForAI}
          disabled={!scanId}
          title="Copy raw scan logs formatted for LLM context"
          className="flex items-center gap-1.5 bg-[var(--bg-card)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-card)] px-3 py-2 rounded-xl font-medium text-xs transition-all cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Copy Logs</span>
        </button>

        <button
          onClick={handleUpdateTools}
          disabled={isUpdating}
          className="flex items-center gap-1.5 bg-[var(--bg-card)] hover:border-[var(--border-glow)] text-[var(--text-primary)] border border-[var(--border-card)] px-3.5 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Tools Hub</span>
        </button>
      </div>
    </div>
  );
}
