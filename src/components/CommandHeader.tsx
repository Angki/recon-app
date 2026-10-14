import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useScanStore } from '../stores/useScanStore';

interface CommandHeaderProps {
  onOpenToolsHub: () => void;
}

export const CommandHeader: React.FC<CommandHeaderProps> = ({ onOpenToolsHub }) => {
  const { status, scanId, selectedTools } = useScanStore();
  const isScanning = status === 'RUNNING';

  return (
    <header className="h-14 border-b border-[var(--border-card)] bg-[var(--bg-surface)]/80 backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
      {/* Telemetry Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)]">
          <div className="relative flex items-center justify-center">
            <div className={`w-2.5 h-2.5 rounded-full ${isScanning ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            {isScanning && (
              <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping opacity-75" />
            )}
          </div>
          <span className="text-xs font-mono font-semibold tracking-wider text-[var(--text-primary)]">
            {isScanning ? `SCAN RUNNING [${selectedTools.length} TOOLS]` : 'SYSTEM STANDBY'}
          </span>
          {scanId && (
            <span className="text-[10px] font-mono text-[var(--text-muted)] border-l border-[var(--border-card)] pl-2">
              ID: {scanId.slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenToolsHub}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-[var(--border-glow)] text-[var(--text-primary)] transition-all cursor-pointer shadow-sm hover:shadow"
        >
          <Cpu className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Engines & Tools Hub</span>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        </button>

        <ThemeSwitcher />
      </div>
    </header>
  );
};
