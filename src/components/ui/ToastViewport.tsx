import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type ToastMessage } from '../../stores/useToastStore';

const TOAST_STYLES = {
  error: {
    panel: 'border-rose-500/40 bg-rose-950/90 text-rose-100',
    icon: 'text-rose-400',
    Icon: AlertCircle,
  },
  warning: {
    panel: 'border-amber-500/40 bg-amber-950/90 text-amber-100',
    icon: 'text-amber-400',
    Icon: AlertTriangle,
  },
  success: {
    panel: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100',
    icon: 'text-emerald-400',
    Icon: CheckCircle2,
  },
  info: {
    panel: 'border-sky-500/40 bg-sky-950/90 text-sky-100',
    icon: 'text-sky-400',
    Icon: Info,
  },
} as const;

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const style = TOAST_STYLES[toast.kind];
  const Icon = style.Icon;

  useEffect(() => {
    const timeout = window.setTimeout(
      () => dismiss(toast.id),
      toast.kind === 'error' ? 8000 : 5000,
    );
    return () => window.clearTimeout(timeout);
  }, [dismiss, toast.id, toast.kind]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md ${style.panel}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {toast.title && (
          <p className="text-xs font-bold">{toast.title}</p>
        )}
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
