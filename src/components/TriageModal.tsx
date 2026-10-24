import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Modal } from './ui/Modal';
import { toast } from '../stores/useToastStore';
import { TRIAGE_STATUS_META, TRIAGE_STATUS_ORDER } from './triageMeta';
import type { Vulnerability } from '../types/vulnerability';
import type { TriageDecision, TriageStatus } from '../types/triage';

interface TriageModalProps {
  finding: Vulnerability;
  decision?: TriageDecision;
  onClose: () => void;
  onSaved: (decision: TriageDecision) => void;
}

export function TriageModal({ finding, decision, onClose, onSaved }: TriageModalProps) {
  const [status, setStatus] = useState<TriageStatus>(decision?.status ?? 'open');
  const [reason, setReason] = useState(decision?.reason ?? '');
  const [expiresAt, setExpiresAt] = useState(decision?.expiresAt ? decision.expiresAt.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const record = async () => {
    if (!finding.fingerprint) {
      setError('This finding has no fingerprint and cannot be triaged.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await window.api.setTriageDecision({
        fingerprint: finding.fingerprint,
        status,
        reason: reason.trim() || undefined,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : undefined,
      });
      onSaved(saved);
      toast.success(`Finding marked as ${TRIAGE_STATUS_META[status].label}.`, 'Triage saved');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message, 'Triage failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      labelledBy="triage-modal-title"
      describedBy="triage-modal-description"
      panelClassName="w-full max-w-lg rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-5 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--border-glow)]">
            <Flag className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <h3 id="triage-modal-title" className="text-base font-bold text-[var(--text-primary)]">Triage Finding</h3>
            <p id="triage-modal-description" className="text-xs text-[var(--text-secondary)] line-clamp-2 max-w-sm">
              {finding.name}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Decision audit</span>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] p-2.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Fingerprint</span>
        <div className="font-mono text-[10px] text-[var(--text-secondary)] break-all select-all">
          {finding.fingerprint || 'Not available for legacy findings'}
        </div>
      </div>

      {decision && (
        <div className="mt-3 rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] p-3 text-[11px] text-[var(--text-secondary)] space-y-1">
          <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${TRIAGE_STATUS_META[decision.status].badgeClass}`}>
            Current: {TRIAGE_STATUS_META[decision.status].label}
          </span>
          {decision.reason && <p className="text-[var(--text-primary)]">{decision.reason}</p>}
          <p className="font-mono text-[10px] text-[var(--text-muted)]">
            {decision.actor || 'operator'} · {new Date(decision.timestamp).toLocaleString()}
            {decision.expiresAt ? ` · expires ${new Date(decision.expiresAt).toLocaleDateString()}` : ''}
          </p>
        </div>
      )}

      <fieldset className="mt-4">
        <legend className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-2">Status</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TRIAGE_STATUS_ORDER.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition-all ${
                status === value
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                  : 'border-[var(--border-card)] bg-[var(--bg-app)] hover:border-[var(--border-glow)]'
              }`}
            >
              <input
                type="radio"
                name="triage-status"
                value={value}
                checked={status === value}
                onChange={() => setStatus(value)}
                className="mt-0.5 accent-[var(--accent-primary)]"
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-[var(--text-primary)]">{TRIAGE_STATUS_META[value].label}</span>
                <span className="block text-[10px] leading-snug text-[var(--text-muted)]">{TRIAGE_STATUS_META[value].description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <label htmlFor="triage-reason" className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Reason / analyst note
        </label>
        <textarea
          id="triage-reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
          placeholder="Why is this decision being recorded? e.g. Manual verification showed the parameter is integer-cast."
          className="w-full resize-none rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
        <div className="mt-1 text-right text-[10px] font-mono text-[var(--text-muted)]">{reason.length}/1000</div>
      </div>

      <div className="mt-2">
        <label htmlFor="triage-expiry" className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Expiry (optional)
        </label>
        <input
          id="triage-expiry"
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          className="w-full rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          Expired decisions stop influencing triage badges and baseline resolution after this date.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[var(--border-card)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all hover:bg-white/5 hover:text-[var(--text-primary)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void record()}
          disabled={saving || !finding.fingerprint}
          className="rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Decision'}
        </button>
      </div>
    </Modal>
  );
}
