interface ToolSelectionProps {
  allTools: string[];
  selectedTools: string[];
  setSelectedTools: (tools: string[] | ((prev: string[]) => string[])) => void;
  status: string;
}

export default function ToolSelection({
  allTools, selectedTools, setSelectedTools, status
}: ToolSelectionProps) {
  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium text-slate-300">Select Scanners to Run:</div>
        <button 
          onClick={() => setSelectedTools(selectedTools.length === allTools.length ? [] : allTools)}
          disabled={status === 'RUNNING'}
          className="text-xs text-blue-400 hover:text-blue-300 underline disabled:opacity-50"
        >
          {selectedTools.length === allTools.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {allTools.map(tool => {
          const isSelected = selectedTools.includes(tool);
          return (
            <button
              key={tool}
              onClick={() => {
                if (isSelected) {
                  setSelectedTools(prev => prev.filter(t => t !== tool));
                } else {
                  setSelectedTools(prev => [...prev, tool]);
                }
              }}
              disabled={status === 'RUNNING'}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                isSelected
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                  : 'bg-slate-900/50 text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'
              } ${status === 'RUNNING' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tool}
            </button>
          );
        })}
      </div>
    </div>
  );
}
