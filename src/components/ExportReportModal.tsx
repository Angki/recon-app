import { useEffect, useState } from 'react';
import { FileText, FileCode, Database, Check, Download, ExternalLink, X, Loader2, ShieldCheck } from 'lucide-react';
import { Modal } from './ui/Modal';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanId: string | null;
  targetUrl: string;
}

type ReportFormat = 'html' | 'md' | 'json' | 'sarif' | 'pdf';

interface FormatOption {
  value: ReportFormat;
  label: string;
  description: string;
  selectedCard: string;
  selectedIcon: string;
  selectedCheck: string;
  icon: typeof FileText;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'pdf',
    label: 'Executive PDF Document (.pdf)',
    description: 'Direct export to high-resolution A4 vector PDF document ready for stakeholders, executive management, and formal compliance submission.',
    selectedCard: 'bg-rose-500/10 border-rose-500 shadow-md shadow-rose-500/20',
    selectedIcon: 'bg-rose-600 text-white',
    selectedCheck: 'text-rose-400',
    icon: FileText,
  },
  {
    value: 'html',
    label: 'Executive HTML & Print Layout (.html)',
    description: 'Self-contained modern interactive web report with risk score gauge, CVSS distribution, @media print layout, and formatted findings.',
    selectedCard: 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] shadow-md shadow-[var(--accent-glow)]',
    selectedIcon: 'bg-[var(--accent-primary)] text-white',
    selectedCheck: 'text-[var(--accent-primary)]',
    icon: FileText,
  },
  {
    value: 'sarif',
    label: 'OASIS SARIF v2.1.0 (.sarif)',
    description: 'Industry standard Static Analysis Results Interchange Format for GitHub Code Scanning, GitLab SAST/DAST, and CI/CD pipelines.',
    selectedCard: 'bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/20',
    selectedIcon: 'bg-blue-600 text-white',
    selectedCheck: 'text-blue-400',
    icon: ShieldCheck,
  },
  {
    value: 'md',
    label: 'GitHub Flavored Markdown (.md)',
    description: 'Clean markdown format ideal for documentation, GitHub Security Advisories, Jira tickets, or developer handoff.',
    selectedCard: 'bg-purple-500/10 border-purple-500 shadow-md shadow-purple-500/20',
    selectedIcon: 'bg-purple-600 text-white',
    selectedCheck: 'text-purple-400',
    icon: FileCode,
  },
  {
    value: 'json',
    label: 'Raw Structured JSON (.json)',
    description: 'Full programmatic schema including metrics, raw tool outputs, and endpoint classifications.',
    selectedCard: 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/20',
    selectedIcon: 'bg-emerald-600 text-white',
    selectedCheck: 'text-emerald-400',
    icon: Database,
  },
];

export function ExportReportModal({ isOpen, onClose, scanId, targetUrl }: ExportReportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('html');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setExportedPath(null);
    setExportError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!scanId || !window.api?.exportReport) {
      setExportError('No completed scan is available to export yet.');
      return;
    }
    setIsExporting(true);
    setExportedPath(null);
    setExportError(null);

    try {
      const res = await window.api.exportReport(scanId, selectedFormat);
      if (res && res.filePath) {
        setExportedPath(res.filePath);
      } else {
        setExportError('The report generator did not return a file path.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setExportError(`Failed to export report: ${message}`);
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="export-report-title"
      describedBy="export-report-description"
      panelClassName="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-4 bg-[var(--bg-surface)] border-b border-[var(--border-card)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--border-glow)]">
            <Download className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="export-report-title" className="text-sm font-bold text-[var(--text-primary)]">Export Security Report</h2>
            <p id="export-report-description" className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-xs">{targetUrl || 'Target Audit'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Close export report dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Format Selector Cards */}
      <div className="p-5 space-y-3 overflow-y-auto flex-1 min-h-0" role="group" aria-label="Report output format">
        <p className="text-xs text-[var(--text-secondary)] font-medium">Select Output Deliverable Format:</p>

        {FORMAT_OPTIONS.map((option) => {
          const isSelected = selectedFormat === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedFormat(option.value)}
              aria-pressed={isSelected}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                isSelected
                  ? option.selectedCard
                  : 'bg-[var(--bg-surface)]/60 border-[var(--border-card)] hover:border-[var(--text-muted)]'
              }`}
            >
              <span className={`p-2 rounded-lg ${isSelected ? option.selectedIcon : 'bg-white/5 text-[var(--text-muted)]'}`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)]">{option.label}</span>
                  {isSelected && <Check className={`w-4 h-4 shrink-0 ${option.selectedCheck}`} aria-hidden="true" />}
                </span>
                <span className="block text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}

        {exportedPath && (
          <div
            role="status"
            className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                Report Generated Successfully!
              </span>
              <button
                type="button"
                onClick={handleOpenFile}
                className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 flex items-center gap-1 cursor-pointer underline"
              >
                <span>Reveal in Folder</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
            <p className="text-[10px] font-mono text-[var(--text-muted)] break-all">{exportedPath}</p>
          </div>
        )}

        {exportError && (
          <div
            role="alert"
            className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 leading-relaxed"
          >
            {exportError}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-[var(--bg-surface)] border-t border-[var(--border-card)] flex justify-end gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-white/5 border border-[var(--border-card)] cursor-pointer"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={!scanId || isExporting}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-[var(--accent-glow)] cursor-pointer"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
          <span>{isExporting ? 'Compiling Report...' : `Generate ${selectedFormat.toUpperCase()} Report`}</span>
        </button>
      </div>
    </Modal>
  );
}
