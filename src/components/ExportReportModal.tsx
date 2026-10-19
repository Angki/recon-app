import { useState } from 'react';
import { FileText, FileCode, Database, Check, Download, ExternalLink, X, Loader2, ShieldCheck } from 'lucide-react';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanId: string | null;
  targetUrl: string;
}

export function ExportReportModal({ isOpen, onClose, scanId, targetUrl }: ExportReportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<'html' | 'md' | 'json' | 'sarif' | 'pdf'>('html');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!scanId || !window.api?.exportReport) return;
    setIsExporting(true);
    setExportedPath(null);

    try {
      const res = await window.api.exportReport(scanId, selectedFormat);
      if (res && res.filePath) {
        setExportedPath(res.filePath);
      }
    } catch (err) {
      console.error('Failed to export report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenFile = () => {
    if (scanId && window.api?.openReportFolder) {
      window.api.openReportFolder(scanId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[var(--bg-surface)] border-b border-[var(--border-card)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--border-glow)]">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Export Security Report</h2>
              <p className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-xs">{targetUrl || 'Target Audit'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector Cards */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-[var(--text-secondary)] font-medium">Select Output Deliverable Format:</p>

          <div
            onClick={() => setSelectedFormat('pdf')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              selectedFormat === 'pdf'
                ? 'bg-rose-500/10 border-rose-500 shadow-md shadow-rose-500/20'
                : 'bg-[var(--bg-surface)]/60 border-[var(--border-card)] hover:border-[var(--text-muted)]'
            }`}
          >
            <div className={`p-2 rounded-lg ${selectedFormat === 'pdf' ? 'bg-rose-600 text-white' : 'bg-white/5 text-[var(--text-muted)]'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">Executive PDF Document (.pdf)</span>
                {selectedFormat === 'pdf' && <Check className="w-4 h-4 text-rose-400" />}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Direct export to high-resolution A4 vector PDF document ready for stakeholders, executive management, and formal compliance submission.
              </p>
            </div>
          </div>

          <div
            onClick={() => setSelectedFormat('html')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              selectedFormat === 'html'
                ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] shadow-md shadow-[var(--accent-glow)]'
                : 'bg-[var(--bg-surface)]/60 border-[var(--border-card)] hover:border-[var(--text-muted)]'
            }`}
          >
            <div className={`p-2 rounded-lg ${selectedFormat === 'html' ? 'bg-[var(--accent-primary)] text-white' : 'bg-white/5 text-[var(--text-muted)]'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">Executive HTML & Print Layout (.html)</span>
                {selectedFormat === 'html' && <Check className="w-4 h-4 text-[var(--accent-primary)]" />}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Self-contained modern interactive web report with risk score gauge, CVSS distribution, @media print layout, and formatted findings.
              </p>
            </div>
          </div>

          <div
            onClick={() => setSelectedFormat('sarif')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              selectedFormat === 'sarif'
                ? 'bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/20'
                : 'bg-[var(--bg-surface)]/60 border-[var(--border-card)] hover:border-[var(--text-muted)]'
            }`}
          >
            <div className={`p-2 rounded-lg ${selectedFormat === 'sarif' ? 'bg-blue-600 text-white' : 'bg-white/5 text-[var(--text-muted)]'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">OASIS SARIF v2.1.0 (.sarif)</span>
                {selectedFormat === 'sarif' && <Check className="w-4 h-4 text-blue-400" />}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Industry standard Static Analysis Results Interchange Format for GitHub Code Scanning, GitLab SAST/DAST, and CI/CD pipelines.
              </p>
            </div>
          </div>

          <div
            onClick={() => setSelectedFormat('md')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              selectedFormat === 'md'
                ? 'bg-purple-500/10 border-purple-500 shadow-md shadow-purple-500/20'
                : 'bg-[var(--bg-surface)]/60 border-[var(--border-card)] hover:border-[var(--text-muted)]'
            }`}
          >
            <div className={`p-2 rounded-lg ${selectedFormat === 'md' ? 'bg-purple-600 text-white' : 'bg-white/5 text-[var(--text-muted)]'}`}>
              <FileCode className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">GitHub Flavored Markdown (.md)</span>
                {selectedFormat === 'md' && <Check className="w-4 h-4 text-purple-400" />}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Clean markdown format ideal for documentation, GitHub Security Advisories, Jira tickets, or developer handoff.
              </p>
            </div>
          </div>

          <div
            onClick={() => setSelectedFormat('json')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              selectedFormat === 'json'
                ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/20'
                : 'bg-[var(--bg-surface)]/60 border-[var(--border-card)] hover:border-[var(--text-muted)]'
            }`}
          >
            <div className={`p-2 rounded-lg ${selectedFormat === 'json' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-[var(--text-muted)]'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">Raw Structured JSON (.json)</span>
                {selectedFormat === 'json' && <Check className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Full programmatic schema including metrics, raw tool outputs, and endpoint classifications.
              </p>
            </div>
          </div>

          {exportedPath && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Report Generated Successfully!
                </span>
                <button
                  onClick={handleOpenFile}
                  className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 flex items-center gap-1 cursor-pointer underline"
                >
                  <span>Reveal in Folder</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[10px] font-mono text-[var(--text-muted)] break-all">{exportedPath}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--bg-surface)] border-t border-[var(--border-card)] flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-white/5 border border-[var(--border-card)] cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleExport}
            disabled={!scanId || isExporting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-[var(--accent-glow)] cursor-pointer"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExporting ? 'Compiling Report...' : `Generate ${selectedFormat.toUpperCase()} Report`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
