import type { TriageStatus } from '../types/triage';

export const TRIAGE_STATUS_META: Record<TriageStatus, {
  label: string;
  description: string;
  badgeClass: string;
}> = {
  open: {
    label: 'Open',
    description: 'Still requires investigation or remediation.',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
  false_positive: {
    label: 'False Positive',
    description: 'Verified as not exploitable or not a real issue.',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  accepted_risk: {
    label: 'Accepted Risk',
    description: 'Known issue accepted by the asset owner for now.',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  fixed: {
    label: 'Fixed',
    description: 'Remediated. Baseline diff flags it as reopened if it returns.',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
};

export const TRIAGE_STATUS_ORDER: TriageStatus[] = ['open', 'false_positive', 'accepted_risk', 'fixed'];
