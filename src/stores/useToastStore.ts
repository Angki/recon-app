import { create } from 'zustand';

export type ToastKind = 'error' | 'warning' | 'success' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (toast: Omit<ToastMessage, 'id'>) => number;
  dismiss: (id: number) => void;
}

let nextToastId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextToastId++;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }].slice(-4),
    }));
    return id;
  },
  dismiss: (id) => set((state) => ({
    toasts: state.toasts.filter((toast) => toast.id !== id),
  })),
}));

const push = (kind: ToastKind, message: string, title?: string) => (
  useToastStore.getState().push({ kind, message, title })
);

export const toast = {
  error: (message: string, title?: string) => push('error', message, title),
  warning: (message: string, title?: string) => push('warning', message, title),
  success: (message: string, title?: string) => push('success', message, title),
  info: (message: string, title?: string) => push('info', message, title),
};
