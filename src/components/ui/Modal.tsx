import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true',
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  describedBy?: string;
  panelClassName?: string;
  overlayClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  children,
  labelledBy,
  describedBy,
  panelClassName = '',
  overlayClassName = '',
  initialFocusRef,
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      const preferred = initialFocusRef?.current;
      if (preferred) {
        preferred.focus();
        return;
      }
      const firstFocusable = panelRef.current ? getFocusableElements(panelRef.current)[0] : null;
      (firstFocusable ?? panelRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const focusIsInside = panelRef.current.contains(activeElement);

      if (event.shiftKey && (!focusIsInside || activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!focusIsInside || activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;

      const restoreTarget = restoreFocusRef.current;
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus();
      }
    };
  }, [isOpen, initialFocusRef]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200 ${overlayClassName}`}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onCloseRef.current();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`outline-none ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
