import { Layers } from 'lucide-react';

interface ToolSelectionProps {
  allTools: string[];
  selectedTools: string[];
  setSelectedTools: (tools: string[] | ((prev: string[]) => string[])) => void;
  status: string;
}

export default function ToolSelection({
  allTools, selectedTools, setSelectedTools, status
}: ToolSelectionProps) {
  const isRunning = status === 'RUNNING';

  const applyPreset = (preset: 'all' | 'recon' | 'dast' | 'none') => {
    if (isRunning) return;
    if (preset === 'all') setSelectedTools(allTools);
    else if (preset === 'none') setSelectedTools([]);
    else if (preset === 'recon') {
      setSelectedTools(['subfinder', 'httpx', 'katana', 'dnsx', 'alterx', 'tlsx', 'naabu']);
    } else if (preset === 'dast') {
      setSelectedTools(['nuclei', 'wapiti', 'ffuf']);
    }
  };

  return (
    <div className="theme-card p-4 rounded-2xl flex flex-col space-y-3 shadow-md">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Active Security Scanners ({selectedTools.length}/{allTools.length})
          </span>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)] font-mono hidden sm:inline">Presets:</span>
          <button
            onClick={() => applyPreset('recon')}
            disabled={isRunning}
            className="px-2 py-0.5 rounded-lg text-[11px] font-mono text-[var(--text-secondary)] hover:text-cyan-400 hover:bg-white/5 border border-[var(--border-card)] transition-all cursor-pointer disabled:opacity-40"
          >
            Recon Suite
          </button>
          <button
            onClick={() => applyPreset('dast')}
            disabled={isRunning}
            className="px-2 py-0.5 rounded-lg text-[11px] font-mono text-[var(--text-secondary)] hover:text-amber-400 hover:bg-white/5 border border-[var(--border-card)] transition-all cursor-pointer disabled:opacity-40"
          >
            DAST Core
          </button>
          <button
            onClick={() => applyPreset(selectedTools.length === allTools.length ? 'none' : 'all')}
            disabled={isRunning}
            className="px-2 py-0.5 rounded-lg text-[11px] font-mono text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 border border-[var(--border-card)] transition-all cursor-pointer disabled:opacity-40"
          >
            {selectedTools.length === allTools.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Tool Toggle Pills */}
      <div className="flex flex-wrap gap-2 pt-1">
        {allTools.map(tool => {
          const isSelected = selectedTools.includes(tool);
          return (
            <button
              key={tool}
              onClick={() => {
                if (isRunning) return;
                if (isSelected) {
                  setSelectedTools(prev => prev.filter(t => t !== tool));
                } else {
                  setSelectedTools(prev => [...prev, tool]);
                }
              }}
              disabled={isRunning}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider font-semibold transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-[var(--border-glow)] shadow-sm'
                  : 'bg-black/20 text-[var(--text-muted)] border-[var(--border-card)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'}`} />
              <span>{tool}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
