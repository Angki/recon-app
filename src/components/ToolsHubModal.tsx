import React from 'react';
import { X } from 'lucide-react';

interface ToolsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ToolsHubModal: React.FC<ToolsHubModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-card)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-card)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Engines & Tools Hub</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <p className="text-sm text-[var(--text-secondary)]">Loading tool health matrix...</p>
        </div>
      </div>
    </div>
  );
};
