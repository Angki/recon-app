import { Play, Square, FolderOpen, Copy, RefreshCw } from 'lucide-react';

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
  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between">
      <div className="flex items-center space-x-4 flex-1 max-w-2xl">
        <div className="flex-1">
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Enter Target URL (e.g., https://makassarkota.go.id)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-500"
            disabled={status === 'RUNNING'}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (status !== 'RUNNING') handleStartScan();
              }
            }}
          />
        </div>
        <label className="flex items-center space-x-2 text-slate-300">
          <input
            type="checkbox"
            checked={isWordpressScan}
            onChange={(e) => setIsWordpressScan(e.target.checked)}
            disabled={status === 'RUNNING'}
            className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm">Wordpress</span>
        </label>
      </div>

      <div className="flex items-center space-x-3 ml-4">
        {status !== 'RUNNING' ? (
          <button
            onClick={handleStartScan}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-900/20"
          >
            <Play className="w-4 h-4" />
            <span>Start Scan</span>
          </button>
        ) : (
          <button
            onClick={handleStopScan}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-red-900/20"
          >
            <Square className="w-4 h-4" />
            <span>Stop Scan</span>
          </button>
        )}

        <button
          onClick={handleOpenFolder}
          disabled={!scanId}
          className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Output</span>
        </button>

        <button
          onClick={handleAnalyzeAI}
          disabled={!scanId || isAnalyzing}
          title="Analyze console logs with configured AI"
          className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-purple-900/20"
        >
          <Copy className="w-4 h-4" />
          <span>{isAnalyzing ? 'Analyzing...' : 'AI Analyst'}</span>
        </button>

        <button
          onClick={handleCopyLogsForAI}
          disabled={!scanId}
          title="Copy full console logs as context for AI Agent"
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20"
        >
          <Copy className="w-4 h-4" />
          <span>Copy for AI</span>
        </button>

        <button
          onClick={handleUpdateTools}
          disabled={isUpdating}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
        >
          <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
          <span>Update Tools</span>
        </button>
      </div>
    </div>
  );
}
