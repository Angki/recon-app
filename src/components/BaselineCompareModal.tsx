import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitCompare,
  HelpCircle,
  Loader2,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import type { BaselineComparison, BaselineFinding } from '../types/triage';
import { normalizeScanTarget } from '../utils/scanTarget';

export interface BaselineScanOption {
  scanId: string;
  target: string;
  status: string;
  startTime: string;
}

type DiffCategory =
  | 'newFindings'
  | 'reopenedFindings'
  | 'persistentFindings'
  | 'resolvedFindings'
  | 'notReassessedFindings';

const CATEGORY_META: Array<{
  key: DiffCategory;
  countKey: keyof BaselineComparison['summary'];
  label: string;
  icon: typeof PlusCircle;
  tone: string;
  badge: string;
}> = [
  { key: 'newFindings', countKey: 'newCount', label: 'New', icon: PlusCircle, tone: 'text-amber-300', badge: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
  { key: 'reopenedFindings', countKey: 'reopenedCount', label: 'Reopened', icon: RefreshCw, tone: 'text-rose-300', badge: 'bg-rose-500/15 border-rose-500/30 text-rose-300' },
  { key: 'persistentFindings', countKey: 'persistentCount', label: 'Persistent', icon: ShieldAlert, tone: 'text-orange-300', badge: 'bg-orange-500/15 border-orange-500/30 text-orange-300' },
  { key: 'resolvedFindings', countKey: 'resolvedCount', label: 'Resolved', icon: CheckCircle2, tone: 'text-emerald-300', badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' },
  { key: 'notReassessedFindings', countKey: 'notReassessedCount', label: 'Not Reassessed', icon: HelpCircle, tone: 'text-slate-300', badge: 'bg-slate-500/15 border-slate-500/30 text-slate-300' },
];

const severityTone: Record<string, string> = {
  critical: 'text-rose-400',
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-emerald-400',
  info: 'text-blue-400',
};

function pickBaseline(currentScan: BaselineScanOption, scans: BaselineScanOption[]): string {
  const target = normalizeScanTarget(currentScan.target);
  const candidates = scans.filter(
    (scan) => scan.scanId !== currentScan.scanId && scan.status === 'COMPLETED' && normalizeScanTarget(scan.target) === target,
  );
  return candidates[0]?.scanId || '';
}

interface BaselineCompareModalProps {
  isOpen: boolean;
  currentScan: BaselineScanOption | null;
  scans: BaselineScanOption[];
  onClose: () => void;
}

export function BaselineCompareModal({ isOpen, currentScan, scans, onClose }: BaselineCompareModalProps) {
  const candidates = useMemo(() => {
    if (!currentScan) return [];
    const target = normalizeScanTarget(currentScan.target);
    return scans.filter(
      (scan) => scan.scanId !== currentScan.scanId && scan.status === 'COMPLETED' && normalizeScanTarget(scan.target) === target,
    );
  }, [scans, currentScan]);

  const initialBaselineId = currentScan ? pickBaseline(currentScan, scans) : '';
  const [baselineScanId, setBaselineScanId] = useState(initialBaselineId);
  const [comparison, setComparison] = useState<BaselineComparison | null>(null);
  const [activeCategory, setActiveCategory] = useState<DiffCategory>('newFindings');
  const [loading, setLoading] = useState(Boolean(initialBaselineId));
  const [error, setError] = useState('');

  const currentScanId = currentScan?.scanId;

  useEffect(() => {
    if (!isOpen || !currentScanId || !baselineScanId) return;
    let active = true;

    window.api.compareBaseline(currentScanId, baselineScanId)
      .then((result) => {
        if (active) setComparison(result);
      })
      .catch((err: unknown) => {
        if (active) {
          setComparison(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, currentScanId, baselineScanId]);

  const baseline = candidates.find((scan) => scan.scanId === baselineScanId);
  const rows: BaselineFinding[] = comparison ? comparison[activeCategory] : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="baseline-modal-title"
      describedBy="baseline-modal-description"
      panelClassName="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-card)] p-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30">
            <GitCompare className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <h3 id="baseline-modal-title" className="text-base font-bold text-[var(--text-primary)]">Baseline Differential</h3>
            <p id="baseline-modal-description" className="text-xs text-[var(--text-secondary)]">
              Compare this assessment against an earlier completed run to separate new, persistent, and resolved findings.
            </p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase ${currentScan?.status === 'COMPLETED' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'}`}>
          Current: {currentScan?.status || 'UNKNOWN'}
        </span>
      </div>

      <div className="border-b border-[var(--border-card)] bg-[var(--bg-app)] p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] p-2.5">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Baseline (earlier)</span>
            <select
              value={baselineScanId}
              onChange={(event) => {
                setBaselineScanId(event.target.value);
                setComparison(null);
                setError('');
                setLoading(true);
              }}
              disabled={candidates.length === 0}
              aria-label="Select baseline scan"
              className="mt-1 w-full cursor-pointer bg-transparent text-xs font-semibold text-[var(--text-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {candidates.length === 0 && <option value="">No completed baseline for this target</option>}
              {candidates.map((scan) => (
                <option key={scan.scanId} value={scan.scanId} className="bg-[var(--bg-card)]">
                  {scan.target} — {format(new Date(scan.startTime), 'MMM d, yyyy HH:mm')}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight className="w-4 h-4 mx-auto text-[var(--text-muted)] rotate-90 md:rotate-0" />

          <div className="rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] p-2.5">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Current scan</span>
            <div className="mt-1 text-xs font-semibold text-[var(--text-primary)] truncate" title={currentScan?.target}>
              {currentScan?.target}
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
              {currentScan ? format(new Date(currentScan.startTime), 'MMM d, yyyy HH:mm') : '-'}
            </div>
          </div>
        </div>

        {baseline && (
          <p className="mt-2 text-[10px] font-mono text-[var(--text-muted)] truncate">
            Baseline ID: {baseline.scanId}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Comparing fingerprints…
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && !baselineScanId && (
          <div className="rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] p-6 text-center text-xs text-[var(--text-muted)]">
            A baseline requires another <strong>COMPLETED</strong> scan of the same target. Finish another assessment of this destination first.
          </div>
        )}

        {!loading && !error && comparison && (
          <>
            {!comparison.canDetermineResolved && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {comparison.resolutionCaveat || 'Missing findings cannot be treated as resolved because this run is incomplete.'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CATEGORY_META.map((category) => {
                const Icon = category.icon;
                const isActive = activeCategory === category.key;
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setActiveCategory(category.key)}
                    aria-pressed={isActive}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      isActive
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'border-[var(--border-card)] bg-[var(--bg-app)] hover:border-[var(--border-glow)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${category.tone}`} />
                    <div className={`mt-1 text-lg font-bold tabular-nums ${category.tone}`}>
                      {comparison.summary[category.countKey]}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                      {category.label}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORY_META.find((c) => c.key === activeCategory)?.badge}`}>
                {CATEGORY_META.find((c) => c.key === activeCategory)?.label}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {rows.length} finding{rows.length === 1 ? '' : 's'}
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] p-6 text-center text-xs text-[var(--text-muted)]">
                No findings in this category for the selected comparison.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--border-card)]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-[var(--bg-surface)] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Severity</th>
                      <th className="px-3 py-2 font-semibold">Engine</th>
                      <th className="px-3 py-2 font-semibold">Finding</th>
                      <th className="px-3 py-2 font-semibold">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-card)]/50">
                    {rows.map((finding) => (
                      <tr key={`${activeCategory}-${finding.id}`} className="hover:bg-white/[0.03]">
                        <td className={`px-3 py-2 font-mono text-[10px] font-bold uppercase ${severityTone[(finding.severity || 'info').toLowerCase()] || severityTone.info}`}>
                          {finding.severity || 'info'}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]">{finding.scanner}</td>
                        <td className="px-3 py-2 text-[var(--text-primary)]">
                          <div className="font-semibold">{finding.name || finding.type || 'Unclassified finding'}</div>
                          {finding.type && finding.name && finding.type !== finding.name && (
                            <div className="font-mono text-[10px] text-[var(--text-muted)]">{finding.type}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-[var(--text-secondary)] break-all">{finding.url || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border-card)] p-4">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
          <MinusCircle className="w-3.5 h-3.5" />
          Matched by deterministic finding fingerprints, not titles.
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
