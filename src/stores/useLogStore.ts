import { create } from 'zustand';

interface LogState {
  rawLogs: string;
  scannerLogs: Record<string, string[]>;
  aiResponse: string;
  isAnalyzing: boolean;
  aiProgressMsg: string;

  // Actions
  appendRawLogs: (log: string) => void;
  appendScannerLog: (scanner: string, log: string) => void;
  clearRawLogs: () => void;
  clearScannerLogs: () => void;
  setAiResponse: (response: string) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setAiProgressMsg: (msg: string) => void;
}

export const useLogStore = create<LogState>((set) => ({
  rawLogs: '',
  scannerLogs: {},
  aiResponse: '',
  isAnalyzing: false,
  aiProgressMsg: 'Analyzing logs with AI... This might take a minute depending on the log size.',

  appendRawLogs: (log) => set((state) => ({ rawLogs: state.rawLogs + log })),
  appendScannerLog: (scanner, log) => set((state) => {
    const prev = state.scannerLogs[scanner] || [];
    return {
      scannerLogs: {
        ...state.scannerLogs,
        [scanner]: [...prev, log]
      }
    };
  }),
  clearRawLogs: () => set({ rawLogs: '', scannerLogs: {} }),
  clearScannerLogs: () => set({ scannerLogs: {} }),
  setAiResponse: (response) => set({ aiResponse: response }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setAiProgressMsg: (msg) => set({ aiProgressMsg: msg }),
}));
